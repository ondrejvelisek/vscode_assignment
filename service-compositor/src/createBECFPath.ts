import { CancellationToken, ErrorMapper, Main_Request, Main_Result, ServiceA, ServiceA_Result, ServiceB, ServiceB_Result, ServiceC, ServiceD, ServiceE, ServiceF } from "./serviceComposition";
import { promisifyB } from "./utils";

export function createBECFPath (b: ServiceB, e: ServiceE, c: ServiceC, f: ServiceF, errorMapper: ErrorMapper) {
    return async (req: Main_Request, timeoutMillis: number, cancellation: CancellationToken): Promise<Main_Result> => {
        try {
            const resB = promisifyB(b, errorMapper)(req, timeoutMillis, cancellation);
            
            const [resEPromise, cancelTokenE] = e.transform(resB)
            cancellation.onCancelled(cancelTokenE);
            
            const [resC, resE] = await Promise.all([c.call(req), resEPromise]);
            
            const resF = f.present(resC, resE);
            return resF;
        } catch (err) {
            console.warn('BECFPath Error');
            throw err;
        }
    }
}
