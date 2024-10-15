import { Context, Service, z } from 'koishi'

declare module 'koishi' {
    interface Context {
        reactive: ReactiveService
    }

    interface Tables {
        [key: `w-reactive-${string}`]: {
            id: string
            value: any
        }
    }
}

export type Watcher<T extends {}> = (updatedKey: keyof T) => void

export type Reactive<T extends {}> = {
    proxy: T
    watch: (watcher: Watcher<T>) => () => void
}

export type DatabaseReactive<T extends {}> = {
    reactive: T
    dispose: () => void
    patch: (fn: (raw: T) => any) => Promise<void>
}

const createReactive = <T extends {}>(value: T): Reactive<T> => {
    const watchers: Watcher<T>[] = []
    const callWatchers = (updatedKey: keyof T) => watchers
        .forEach(watcher => watcher(updatedKey))

    const proxy = new Proxy(value, {
        set: (_, k, v) => {
            value[k] = v
            callWatchers(k as keyof T)
            return true
        }
    })

    return {
        proxy,
        watch: watcher => {
            watchers.push(watcher)
            return () => {
                const index = watchers.indexOf(watcher)
                if (index >= 0) watchers.splice(index, 1)
            }
        }
    }
}

class ReactiveService extends Service {
    static readonly inject = [ 'database' ]

    constructor(ctx: Context, public config: ReactiveService.Config) {
        super(ctx, 'reactive')
    }

    async create<T extends {}>(name: string, id: string, defaultValue: T): Promise<DatabaseReactive<T>> {
        const table = `w-reactive-${name}` as const
        this.ctx.model.extend(table, {
            id: 'string',
            value: 'json'
        }, { primary: 'id' })
        const [ rec ] = await this.ctx.database.get(table, id)
        const value: T = rec?.value
            ?? (await this.ctx.database.create(table, { id, value: defaultValue })).value
        const { proxy, watch } = createReactive(value)
        const update = () => this.ctx.database.set(table, id, { value })
        const unwatch = watch(update)
        return {
            reactive: proxy,
            dispose: unwatch,
            patch: async (fn) => {
                await fn(value)
                await update()
            }
        }
    }
}

namespace ReactiveService {
    export interface Config {}

    export const Config = z.object({})
}

export default ReactiveService