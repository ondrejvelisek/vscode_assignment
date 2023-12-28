import * as assert from 'node:assert'
import {
    ServiceComposition, Main_Request, Main_Result,
    ServiceA, ServiceA_InvocationToken, ServiceA_Result,
    ServiceB, ServiceB_Result,
    ServiceC, ServiceC_Result,
    ServiceD,
    ServiceE, ServiceE_CancelToken, ServiceE_Result,
    ServiceF,
    ErrorMapper,
    CancellationToken,
} from "./serviceComposition";


suite("Service Composition", () => {

    test("Happy path (A + B) -> D", async () => {
        let polls = 0
        const a: ServiceA = {
            start(req) {
                assert.equal(req, "main")
                return "tokenA"
            },
            poll(tok) {
                assert.equal(tok, "tokenA")
                polls += 1
                return polls > 2 ? "resultA" : null
            },
            abort(tok) { }
        }
        const b: ServiceB = {
            submit(req, isCancelled, timeout, callback) {
                assert.equal(req, "main")
                callback(undefined, "resultB")
            }
        }
        const d: ServiceD = {
            async merge(a, b) {
                assert.equal(a, "resultA")
                assert.equal(b, "resultB")
                return "resultD"
            }
        }
        const sut = createSUT({ a, b, d })
        const result = await sut.run("main", 1000, stubCancelledNever)
        assert.equal(result, "resultD")
    })

    test("Happy path ((B -> E) + C) -> F", async () => {
        const b: ServiceB = {
            submit(req, isCancelled, timeout, callback) {
                assert.equal(req, "main")
                callback(undefined, "resultB")
            }
        }
        const c: ServiceC = {
            async call(req) {
                assert.equal(req, "main")
                return "resultC"
            }
        }
        const e: ServiceE = {
            transform(bFut) {
                return [new Promise(r => {
                    bFut.then(b => {
                        assert.equal(b, "resultB")
                        r("resultE")
                    })
                }), () => { }]
            },
            combine: stubServiceENever
        }
        const f: ServiceF = {
            present(c, e) {
                assert.equal(c, "resultC")
                assert.equal(e, "resultE")
                return "resultF"
            }
        }
        const sut = createSUT({ b, c, e, f })
        const result = await sut.run("main", 1000, stubCancelledNever)
        assert.equal(result, "resultF")
    })

    test("Happy path (((A + C) -> E) + C) -> F", async () => {
        let polls = 0
        const a: ServiceA = {
            start(req) {
                assert.equal(req, "main")
                return "tokenA"
            },
            poll(tok) {
                assert.equal(tok, "tokenA")
                polls += 1
                return polls > 2 ? "resultA" : null
            },
            abort(tok) { }
        }
        const c: ServiceC = {
            async call(req) {
                assert.equal(req, "main")
                return "resultC"
            }
        }
        const e: ServiceE = {
            transform: stubServiceENever,
            combine(aPromise, cPromise) {
                return [new Promise(async (resolve) => {
                    const [a, c] = await Promise.all([aPromise, cPromise]);
                    assert.equal(a, "resultA")
                    assert.equal(c, "resultC")
                    resolve("resultE")
                }), () => { }]
            }
        }
        const f: ServiceF = {
            present(c, e) {
                assert.equal(c, "resultC")
                assert.equal(e, "resultE")
                return "resultF"
            }
        }
        const sut = createSUT({ a, c, e, f })
        const result = await sut.run("main", 1000, stubCancelledNever)
        assert.equal(result, "resultF")
    })

    test("Timeout", async () => {
        const sut = createSUT({})
        try {
            await sut.run("main", 1000, stubCancelledNever)
            assert.fail("Should have timed out")
        } catch (err) {
            assert.equal((err as Error).message, "timedOut")
        }
    })

    // This highly depends on Services implementation. 
    // To be really sure of non blocking implementation we would need to implement multithreading
    // which is not possible without change of given API.
    test("No blocking", async () => {
        let timestamp = Date.now()
        const a: ServiceA = {
            start(req) {
                assert.equal(req, "main")
                return "tokenA"
            },
            poll(tok) {
                assert.equal(tok, "tokenA")
                return Date.now() > timestamp + 300 ? "resultA" : null
            },
            abort(tok) { }
        }
        const b: ServiceB = {
            submit(req, isCancelled, timeout, callback) {
                assert.equal(req, "main")
                setTimeout(() => callback(undefined, "resultB"), 300)
            }
        }
        const c: ServiceC = {
            async call(req) {
                assert.equal(req, "main")
                return new Promise((resolve) => setTimeout(() => resolve("resultC"), 300))
            }
        }
        const d: ServiceD = {
            async merge(a, b) {
                assert.equal(a, "resultA")
                assert.equal(b, "resultB")
                return new Promise((resolve) => setTimeout(() => resolve("resultD"), 300))
            }
        }
        const e: ServiceE = {
            transform(bFut) {
                return [new Promise(resolve => {
                    bFut.then(b => {
                        assert.equal(b, "resultB")
                        return setTimeout(() => resolve("resultE"), 300);
                    })
                }), () => { }]
            },
            combine(aPromise, cPromise) {
                return [new Promise(async (resolve) => {
                    const [a, c] = await Promise.all([aPromise, cPromise]);
                    assert.equal(a, "resultA")
                    assert.equal(c, "resultC")
                    return setTimeout(() => resolve("resultE"), 300);
                }), () => { }]
            }
        }
        const f: ServiceF = {
            present(c, e) {
                assert.equal(c, "resultC")
                assert.equal(e, "resultE")
                return "resultF"
            }
        }
        const sut = createSUT({ a, b, c, d, e, f })
        const stopTicking = assertTime(Date.now())
        const result = await sut.run("main", 1000, stubCancelledNever)
        assert.equal(result, "resultF")
        stopTicking()
    })
})

// Every 10 ms adds task to event loop queue and checks if it is called at most 100 ms later. 
const ASSERT_DELAY = 10;
function assertTime(callTimestamp: number): () => void {
    assert.equal(Date.now() < callTimestamp + 100, true);
    const nextCallTimestamp = Date.now() + ASSERT_DELAY;
    let stopTicking: () => void;
    const timeout = setTimeout(() => {
        stopTicking = assertTime(nextCallTimestamp)
    }, ASSERT_DELAY)
    return () => {
        clearTimeout(timeout)
        stopTicking?.();
    }
}

function createSUT(overrides: {
    a?: ServiceA,
    b?: ServiceB,
    c?: ServiceC,
    d?: ServiceD,
    e?: ServiceE,
    f?: ServiceF,
    errorMapper?: ErrorMapper,
}) {
    return new ServiceComposition(
        overrides.a ?? { start: () => "tok", poll: () => null, abort: () => { } },
        overrides.b ?? { submit: stubServiceNever },
        overrides.c ?? { call: stubServiceNever },
        overrides.d ?? { merge: stubServiceNever },
        overrides.e ?? {
            combine: stubServiceENever,
            transform: stubServiceENever,
        },
        overrides.f ?? { present: (c, e) => c + e },
        overrides.errorMapper ?? {
            aborted: () => new Error("aborted"),
            timedOut: () => new Error("timedOut"),
            error: async errs => errs[0]
        }
    )
}

const stubServiceNever: (...args: any[]) => Promise<any> = (...args) => new Promise(r => { })
const stubServiceENever: (...args: any[]) => [Promise<ServiceE_Result>, ServiceE_CancelToken] = (...args) => [new Promise(r => { }), () => { }]
const stubCancelledNever: CancellationToken = {
    isCancelled() { return false },
    onCancelled(listener) { },
}
