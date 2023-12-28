import { CancellationToken, ErrorMapper, ServiceA, ServiceA_Result, ServiceB, ServiceB_Result, ServiceC, ServiceD, ServiceE, ServiceF } from "./serviceComposition";

export type Main_Request = string
export type Main_Result = string

export function createACECFPath (a: ServiceA, c: ServiceC, e: ServiceE, f: ServiceF, errorMapper: ErrorMapper) {
    return async (req: Main_Request, timeoutMillis: number, cancellation: CancellationToken): Promise<Main_Result> => {
        const tokenA = a.start(req)
        let resA: ServiceA_Result;
        // TODO add polling
        resA = a.poll(tokenA) ?? '';
        resA = a.poll(tokenA) ?? resA ?? '';
        resA = a.poll(tokenA) ?? resA ?? '';
        resA = a.poll(tokenA) ?? resA ?? '';
        resA = a.poll(tokenA) ?? resA ?? '';
        const resC = await c.call(req);
        const [resE2Promise, cancelTokenE2] = e.combine(Promise.resolve(resA), Promise.resolve(resC));
        const resE2 = await resE2Promise;
        const resF2 = f.present(resC, resE2);
        return resF2;
    }
}