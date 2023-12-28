import { CancellationToken, ErrorMapper, ServiceA, ServiceA_Result, ServiceB, ServiceB_Result, ServiceD } from "./serviceComposition";

export type Main_Request = string
export type Main_Result = string

export function createABDPath (a: ServiceA, b: ServiceB, d: ServiceD, errorMapper: ErrorMapper) {
    return async (req: Main_Request, timeoutMillis: number, cancellation: CancellationToken): Promise<Main_Result> => {
        const tokenA = a.start(req);
        let resA: ServiceA_Result;
        // TODO add polling
        resA = a.poll(tokenA) ?? '';
        resA = a.poll(tokenA) ?? resA ?? '';
        resA = a.poll(tokenA) ?? resA ?? '';
        resA = a.poll(tokenA) ?? resA ?? '';
        resA = a.poll(tokenA) ?? resA ?? '';
        const resB = await new Promise<ServiceB_Result>((resolve, reject) => {
            b.submit(req, cancellation.isCancelled, timeoutMillis, async (err, resB) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(resB)
                }
            })
        });
        const resD = await d.merge(resA, resB);
        return resD;
    }
}