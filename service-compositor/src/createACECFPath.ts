import { CancellationToken, ErrorMapper, Main_Request, Main_Result, ServiceA, ServiceA_Result, ServiceB, ServiceB_Result, ServiceC, ServiceD, ServiceE, ServiceF } from "./serviceComposition";
import { promisifyA } from "./utils";

export function createACECFPath (a: ServiceA, c: ServiceC, e: ServiceE, f: ServiceF, errorMapper: ErrorMapper) {
    return async (req: Main_Request, timeoutMillis: number, cancellation: CancellationToken): Promise<Main_Result> => {
        try {
            const resAPromise = promisifyA(a, errorMapper)(req, timeoutMillis, cancellation);
            const resCPromise = c.call(req);
            
            const [resEPromise, cancelTokenE] = e.combine(resAPromise, resCPromise);
            cancellation.onCancelled(cancelTokenE);

            // No need to Promise.all since I suppose Service E waits for promise C anyway since it is a dependency
            const resE = await resEPromise;
            const resC = await resCPromise;

            const resF = f.present(resC, resE);
            return resF;
        } catch (err) {
            throw err;
        }
    }
}