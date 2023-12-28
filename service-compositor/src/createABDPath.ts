import { CancellationToken, ErrorMapper, Main_Request, Main_Result, ServiceA, ServiceA_Result, ServiceB, ServiceB_Result, ServiceD } from "./serviceComposition";
import { promisifyB } from "./utils";

export function createABDPath (a: ServiceA, b: ServiceB, d: ServiceD, errorMapper: ErrorMapper) {
    return async (req: Main_Request, timeoutMillis: number, cancellation: CancellationToken): Promise<Main_Result> => {
        const tokenA = a.start(req);
        let resA: ServiceA_Result;
        // TODO add polling
        resA = a.poll(tokenA) ?? '';
        resA = a.poll(tokenA) ?? resA ?? '';
        resA = a.poll(tokenA) ?? resA ?? '';
        resA = a.poll(tokenA) ?? resA ?? '';
        resA = a.poll(tokenA) ?? resA ?? '';
        const resB = await promisifyB(b)(req, timeoutMillis, cancellation);
        const resD = await d.merge(resA, resB);
        return resD;
    }
}