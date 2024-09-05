import { Context, Create, Keys, Query, Service, Tables, Update, z } from 'koishi'
import { Reactive, reactive } from '@vue/reactivity'
import { watch } from '@vue-reactivity/watch'

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

export type ReactiveHandler<T> = {
    reactive: Reactive<T>
    dispose: () => void
    patch: (fn: (raw: T) => any) => Promise<void>
}

class ReactiveService<C extends Context = Context> extends Service {
    static readonly inject = [ 'database' ]

    constructor(ctx: C, _config: ReactiveService.Config) {
        super(ctx, 'reactive')
    }

    async create<T extends {}>(name: string, id: string, defaultValue: T): Promise<ReactiveHandler<T>> {
        const table = `w-reactive-${name}` as const
        this.ctx.model.extend(table, {
            id: 'string',
            value: 'json'
        }, { primary: 'id' })
        const [ rec ] = await this.ctx.database.get(table, id)
        let value: T = rec?.value ?? await this.ctx.database.create(table, { id, value: defaultValue })
        const proxy = reactive(value)
        const update = () => this.ctx.database.set(table, id, { value })
        const unwatch = watch(proxy, update)
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