import { CancellationToken, ErrorMapper, Main_Request, ServiceA, ServiceA_Result, ServiceB, ServiceB_Result, ServiceD } from "./serviceComposition";

export function promisifyA (a: ServiceA) {
    return async (req: Main_Request, timeoutMillis: number, cancellation: CancellationToken): Promise<ServiceA_Result> => {
        return new Promise((resolve, reject) => {
            const token = a.start(req);
            const startMillis = Date.now();
            const endMillis = startMillis + timeoutMillis;
            
            let res: ServiceA_Result|null = a.poll(token);
            if (res) {
                resolve(res);
                return;
            }

            const interval = setInterval(() => {
                res = a.poll(token);
                if (res) {
                    clearInterval(interval);
                    resolve(res);
                } else if (Date.now() > endMillis) {
                    clearInterval(interval);
                    // TODO use ErrorMapper and timeout error
                    reject(new Error('timedOut'));
                }
                // else continue ticking
            }, 10);

            cancellation.onCancelled(() => {
                clearInterval(interval);
                // TODO use ErrorMapper and aborted error
                reject(new Error('aborted'));
                a.abort(token);
            });
        })
    }
}

export function promisifyB (b: ServiceB) {
    return async (req: Main_Request, timeoutMillis: number, cancellation: CancellationToken): Promise<ServiceB_Result> => {
        return await new Promise<ServiceB_Result>((resolve, reject) => {
            b.submit(req, cancellation.isCancelled, timeoutMillis, async (err, resB) => {
                if (err) {
                    // TODO use ErrorMapper
                    reject(err)
                } else {
                    resolve(resB)
                }
            })
        });
    }
}