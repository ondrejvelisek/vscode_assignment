import { CancellationToken, ErrorMapper, Main_Request, ServiceA, ServiceA_Result, ServiceB, ServiceB_Result, ServiceD } from "./serviceComposition";

export function promisifyB (b: ServiceB) {
    return async (req: Main_Request, timeoutMillis: number, cancellation: CancellationToken): Promise<ServiceB_Result> => {
        return await new Promise<ServiceB_Result>((resolve, reject) => {
            b.submit(req, cancellation.isCancelled, timeoutMillis, async (err, resB) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(resB)
                }
            })
        });
    }
}