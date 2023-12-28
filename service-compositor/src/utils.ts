import { CancellationToken, ErrorMapper, Main_Request, ServiceA, ServiceA_Result, ServiceB, ServiceB_Result, ServiceD } from "./serviceComposition";

export function promisifyA (a: ServiceA) {
    return async (req: Main_Request, timeoutMillis: number, cancellation: CancellationToken): Promise<ServiceA_Result> => {
        return new Promise((resolve, reject) => {
            const token = a.start(req);
            const startMillis = Date.now();
            const endMillis = startMillis + timeoutMillis;
            
            let res: ServiceA_Result|null = null;

            // TODO dont block thread
            while(Date.now() < endMillis && !res) {
                res = a.poll(token)
            }
            if (!res) {
                //TODO use ErrorMapper and timeout error
                reject(new Error('timedOut'));
            } else {
                resolve(res);
            }
        })
    }
}

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