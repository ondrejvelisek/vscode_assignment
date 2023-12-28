import { CancellationToken, ErrorMapper, Main_Request, Main_Result, ServiceA, ServiceA_Result, ServiceB, ServiceB_Result, ServiceD } from "./serviceComposition";
import { promisifyA, promisifyB } from "./utils";

export function createABDPath (a: ServiceA, b: ServiceB, d: ServiceD, errorMapper: ErrorMapper) {
    return async (req: Main_Request, timeoutMillis: number, cancellation: CancellationToken): Promise<Main_Result> => {
        const resA = await promisifyA(a)(req, timeoutMillis, cancellation);
        const resB = await promisifyB(b)(req, timeoutMillis, cancellation);
        const resD = await d.merge(resA, resB);
        return resD;
    }
}