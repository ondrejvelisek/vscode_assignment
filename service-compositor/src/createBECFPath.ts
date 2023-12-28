import { CancellationToken, ErrorMapper, Main_Request, Main_Result, ServiceA, ServiceA_Result, ServiceB, ServiceB_Result, ServiceC, ServiceD, ServiceE, ServiceF } from "./serviceComposition";
import { promisifyB } from "./utils";

export function createBECFPath (b: ServiceB, e: ServiceE, c: ServiceC, f: ServiceF, errorMapper: ErrorMapper) {
    return async (req: Main_Request, timeoutMillis: number, cancellation: CancellationToken): Promise<Main_Result> => {
        const resB = await promisifyB(b, errorMapper)(req, timeoutMillis, cancellation);
        const [resE1Promise, cancelTokenE1] = e.transform(Promise.resolve(resB))
        const resE1 = await resE1Promise;
        const resC = await c.call(req);
        const resF1 = f.present(resC, resE1);
        return resF1;
    }
}
