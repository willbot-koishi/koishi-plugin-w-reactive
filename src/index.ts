import { Context, Create, Keys, Query, Service, Tables, Update, z } from 'koishi'
import { reactive } from '@vue/reactivity'
import { watch } from '@vue-reactivity/watch'

declare module 'koishi' {
    interface Context {
        reactive: ReactiveService
    }
}

export type Reactive<T> = {
    reactive: T
    dispose: () => void
    patch: (fn: (raw: T) => any) => Promise<void>
}

class ReactiveService<C extends Context = Context> extends Service {
    static readonly inject = [ 'database' ]

    constructor(ctx: C, _config: ReactiveService.Config) {
        super(ctx, 'reactive')
    }

    async create<K extends Keys<Tables>>(
        table: K,
        query: Query<Tables[K]>,
        defaultValue: Create<Tables[K], Tables>
    ): Promise<Reactive<Tables[K]>> {
        let [ raw ] = await this.ctx.database.get(table, query)
        raw ??= await this.ctx.database.create(table, defaultValue)
        const proxy = reactive(raw) as Tables[K]
        const update = () => {
            const up = { ...raw }
            if ('id' in up) delete up.id
            return this.ctx.database.set(table, query, up as Update<Tables[K]>)
        }
        const unwatch = watch(proxy, update)
        return {
            reactive: proxy,
            dispose: unwatch,
            patch: async (fn) => {
                await fn(raw)
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