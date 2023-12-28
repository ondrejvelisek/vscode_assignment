import { CancellationToken, ErrorMapper, Main_Request, ServiceA, ServiceA_Result, ServiceB, ServiceB_Result, ServiceD } from "./serviceComposition";

export function promisifyA (a: ServiceA, errorMapper: ErrorMapper) {
    return async (req: Main_Request, timeoutMillis: number, cancellation: CancellationToken): Promise<ServiceA_Result> => {
        return await new Promise((resolve, reject) => {
            try {
                const token = a.start(req);
                const startMillis = Date.now();
                const endMillis = startMillis + timeoutMillis;

                let res: ServiceA_Result|null = a.poll(token);
                if (res) {
                    resolve(res);
                    return;
                }

                const interval = setInterval(() => {
                    try {
                        res = a.poll(token);
                    } catch (err) {
                        clearInterval(interval);
                        reject(err)
                    }
                    if (res) {
                        clearInterval(interval);
                        resolve(res);
                    } else if (Date.now() > endMillis) {
                        clearInterval(interval);
                        reject(errorMapper.timedOut());
                    }
                    // else continue ticking
                }, 10);

                cancellation.onCancelled(() => {
                    clearInterval(interval);
                    reject(errorMapper.aborted());
                    a.abort(token);
                });

            } catch (err) {
                reject(err)
            }
        })
    }
}

export function promisifyB (b: ServiceB, errorMapper: ErrorMapper) {
    // Be carefull to pass correct timeoutMillis (e.g. when service B is called after some other service awaited)
    return async (req: Main_Request, timeoutMillis: number, cancellation: CancellationToken): Promise<ServiceB_Result> => {
        return await new Promise<ServiceB_Result>((resolve, reject) => {
            b.submit(req, cancellation.isCancelled, timeoutMillis, async (err, res) => {
                if (err) {
                    reject(errorMapper.error([err]));
                } else {
                    resolve(res)
                }
            })
        });
    }
}