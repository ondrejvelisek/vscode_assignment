import { CancellationToken, ErrorMapper, Main_Request, Main_Result, ServiceA, ServiceA_Result, ServiceB, ServiceB_Result, ServiceC, ServiceD, ServiceE, ServiceF } from "./serviceComposition";
import { promisifyA } from "./utils";

export function createACECFPath (a: ServiceA, c: ServiceC, e: ServiceE, f: ServiceF, errorMapper: ErrorMapper) {
    return async (req: Main_Request, timeoutMillis: number, cancellation: CancellationToken): Promise<Main_Result> => {
        const resA = await promisifyA(a, errorMapper)(req, timeoutMillis, cancellation);
        const resC = await c.call(req);
        const [resE2Promise, cancelTokenE2] = e.combine(Promise.resolve(resA), Promise.resolve(resC));
        const resE2 = await resE2Promise;
        const resF2 = f.present(resC, resE2);
        return resF2;
    }
}