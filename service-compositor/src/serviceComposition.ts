import { createABDPath } from "./createABDPath";
import { createACECFPath } from "./createACECFPath";
import { createBECFPath } from "./createBECFPath";

export type Main_Request = string
export type Main_Result = string

export class ServiceComposition {
    abdPath: (req: string, timeoutMillis: number, cancellation: CancellationToken) => Promise<Main_Result>;
    becfPath: (req: string, timeoutMillis: number, cancellation: CancellationToken) => Promise<Main_Result>;
    acecfPath: (req: string, timeoutMillis: number, cancellation: CancellationToken) => Promise<Main_Result>;

    constructor(
        private a: ServiceA,
        private b: ServiceB,
        private c: ServiceC,
        private d: ServiceD,
        private e: ServiceE,
        private f: ServiceF,
        private errorMapper: ErrorMapper,
    ){
        this.abdPath = createABDPath(a, b, d, errorMapper);
        this.becfPath = createBECFPath(b, e, c, f, errorMapper);
        this.acecfPath = createACECFPath(a, c, e, f, errorMapper);
    }

    async run(req: Main_Request, timeoutMillis: number, cancellation: CancellationToken): Promise<Main_Result> {
        try {
            const abdPromise = this.abdPath(req, timeoutMillis, cancellation);
            const becfPromise = this.becfPath(req, timeoutMillis, cancellation);
            const acecfPromise = this.acecfPath(req, timeoutMillis, cancellation);
            const result = await Promise.any([abdPromise, becfPromise, acecfPromise]);
            return result;
        } catch (err) {
            if (err instanceof Error) {
                throw await this.errorMapper.error([err]);
            } else {
                throw await this.errorMapper.error([new Error(`${err}`)]);
            }
        }
    }
}

export type ServiceA_InvocationToken = string
export type ServiceA_Result = string
export interface ServiceA {
    start(req: Main_Request): ServiceA_InvocationToken;
	
	/**
	 * @param tok obtained from previous call to {@link #start}
	 * @return result of invocation identified by Token if it already finished and result has not been collected yet,
	 * 			or null if invocation has not finished yet or the result has already been collected.
	 */
	poll(tok: ServiceA_InvocationToken): ServiceA_Result | null;
    abort(tok: ServiceA_InvocationToken): void
}


export type ServiceB_Result = string
export interface ServiceB {

	/**
	 * @param timeout if result is not available within timeout will complete with error
	 * @param isCancelled the implementation may check this to see if caller is still interested in the result,
	 * 				     if this returns true will be completed by error early
	 * @param callback exactly one of Result or Error will be present
	 */
	submit(
        req: Main_Request, 
        isCancelled: () => boolean, 
        timeout: number,
        callback: (err: Error | undefined, result: ServiceB_Result) => void
    ): void;
}

export type ServiceC_Result = string
export interface ServiceC {

	call(req: Main_Request): Promise<ServiceC_Result>;	
}

export interface ServiceD {

	/**
	 * @return may be completed exceptionally if merging fails
	 */
	merge(a: ServiceA_Result, b: ServiceB_Result): Promise<Main_Result>;	
}

export type ServiceE_Result = string
export type ServiceE_CancelToken = () => void
export interface ServiceE {

    /**
     * 
     * @returns future for the result and callback that may be called to abort execution early,
     *          when aborted the future will be rejected by error
     */
	transform(b: Promise<ServiceB_Result>): [Promise<ServiceE_Result>, ServiceE_CancelToken];	
    combine(a: Promise<ServiceA_Result>, c: Promise<ServiceC_Result>): [Promise<ServiceE_Result>, ServiceE_CancelToken];	
}

export interface ServiceF {

    present(c: ServiceC_Result, e: ServiceE_Result): Main_Result;
}

export interface ErrorMapper {
    error(orig: Error[]): Promise<Error>
    timedOut(): Error
    aborted(): Error
}

export interface CancellationToken {
    isCancelled(): boolean
    onCancelled(listener: () => void): void
}
