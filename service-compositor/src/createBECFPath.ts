import { CancellationToken, ErrorMapper, ServiceA, ServiceA_Result, ServiceB, ServiceB_Result, ServiceC, ServiceD, ServiceE, ServiceF } from "./serviceComposition";

export type Main_Request = string
export type Main_Result = string

export function createBECFPath (b: ServiceB, e: ServiceE, c: ServiceC, f: ServiceF, errorMapper: ErrorMapper) {
    return async (req: Main_Request, timeoutMillis: number, cancellation: CancellationToken): Promise<Main_Result> => {
        const resB = await new Promise<ServiceB_Result>((resolve) => {
            b.submit(req, cancellation.isCancelled, timeoutMillis, async (err, resB) => {
                resolve(resB)
            })
        })
        const [resE1Promise, cancelTokenE1] = e.transform(Promise.resolve(resB))
        const resE1 = await resE1Promise;
        const resC = await c.call(req);
        const resF1 = f.present(resC, resE1);
        return resF1;
    }
}
