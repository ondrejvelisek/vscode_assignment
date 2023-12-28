import * as assert from 'node:assert'
import { mock } from 'node:test'
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

// Tests could be way faster. Just play wth timeouts and its constants
const DELAY = 300;

suite("Service Composition", () => {
    // FIXME: Does not work when tests runs in parallel;
    let timestamp = Date.now();
    const a: ServiceA = {
        start(req) {
            assert.equal(req, "main")
            timestamp = Date.now();
            return "tokenA"
        },
        poll(tok) {
            assert.equal(tok, "tokenA")
            return Date.now() > timestamp + DELAY ? "resultA" : null
        },
        abort(tok) { }
    }
    const b: ServiceB = {
        submit(req, isCancelled, timeout, callback) {
            assert.equal(req, "main")
            setTimeout(() => callback(undefined, "resultB"), DELAY)
        }
    }
    const c: ServiceC = {
        async call(req) {
            assert.equal(req, "main")
            return new Promise((resolve) => setTimeout(() => resolve("resultC"), DELAY))
        }
    }
    const d: ServiceD = {
        async merge(a, b) {
            assert.equal(a, "resultA")
            assert.equal(b, "resultB")
            return new Promise((resolve) => setTimeout(() => resolve("resultD"), DELAY))
        }
    }
    const e: ServiceE = {
        transform(bFut) {
            return [new Promise((resolve, reject) => {
                bFut.then(b => {
                    assert.equal(b, "resultB")
                    return setTimeout(() => resolve("resultE"), DELAY);
                }, reject)
            }), () => { }]
        },
        combine(aPromise, cPromise) {
            return [(async () => {
                const [a, c] = await Promise.all([aPromise, cPromise]);
                return new Promise((resolve) => setTimeout(() => resolve("resultE"), DELAY));
            })(), () => { }]
        }
    }
    const f: ServiceF = {
        present(c, e) {
            assert.equal(c, "resultC")
            assert.equal(e, "resultE")
            return "resultF"
        }
    }

    test("Happy path (A + B) -> D", async () => {
        const sut = createSUT({ a, b, d })
        const result = await sut.run("main", 1000, stubCancelledNever)
        assert.equal(result, "resultD")
    })

    test("Happy path ((B -> E) + C) -> F", async () => {
        const sut = createSUT({ b, c, e, f })
        const result = await sut.run("main", 1000, stubCancelledNever)
        assert.equal(result, "resultF")
    })

    test("Happy path (((A + C) -> E) + C) -> F", async () => {
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
        const sut = createSUT({ a, b, c, d, e, f })
        const stopTicking = assertTime(Date.now())
        const result = await sut.run("main", 1000, stubCancelledNever)
        assert.equal(result, "resultF")
        stopTicking()
    })

    test("Error Service A and F", async () => {
        let timestamp = Date.now()
        const a: ServiceA = {
            start(req) {
                assert.equal(req, "main")
                return "tokenA"
            },
            poll(tok) {
                assert.equal(tok, "tokenA")
                if (Date.now() > timestamp + DELAY) {
                    throw new Error('Service A failed')
                } else {
                    return null;
                }
            },
            abort(tok) { }
        }
        const f: ServiceF = {
            present(c, e) {
                throw new Error('Service F failed');
            }
        }
        const errorMapper = {
            aborted: () => new Error("aborted"),
            timedOut: () => new Error("timedOut"),
            error: async () => new Error("wrapped"),
        }
        const sut = createSUT({ a, b, c, d, e, f, errorMapper })
        return assert.rejects(
            sut.run("main", 1000, stubCancelledNever),
            new Error("wrapped")
        )
    })

    test("Error Service A and B", async () => {
        let timestamp = Date.now()
        const a: ServiceA = {
            start(req) {
                assert.equal(req, "main")
                return "tokenA"
            },
            poll(tok) {
                assert.equal(tok, "tokenA")
                if (Date.now() > timestamp + DELAY) {
                    throw new Error('Service A failed')
                } else {
                    return null;
                }
            },
            abort(tok) { }
        }
        const b: ServiceB = {
            submit(req, isCancelled, timeout, callback) {
                assert.equal(req, "main")
                setTimeout(() => callback(new Error('Service B failed'), ''), DELAY)
            }
        }
        const errorMapper = {
            aborted: () => new Error("aborted"),
            timedOut: () => new Error("timedOut"),
            error: async () => new Error("wrapped"),
        }
        const sut = createSUT({ a, b, c, d, e, f, errorMapper })
        return assert.rejects(
            sut.run("main", 1000, stubCancelledNever),
            new Error("wrapped")
        )
    })

    test("Error Service C and D", async () => {
        const c: ServiceC = {
            async call(req) {
                assert.equal(req, "main")
                return new Promise((resolve, reject) => setTimeout(() => reject(new Error("Service C failed")), DELAY))
            }
        }
        const d: ServiceD = {
            async merge(a, b) {
                assert.equal(a, "resultA")
                assert.equal(b, "resultB")
                return new Promise((resolve, reject) => setTimeout(() => reject(new Error("Service D failed")), DELAY))
            }
        }
        const errorMapper = {
            aborted: () => new Error("aborted"),
            timedOut: () => new Error("timedOut"),
            error: async () => new Error("wrapped"),
        }
        const sut = createSUT({ a, b, c, d, e, f, errorMapper })
        return assert.rejects(
            sut.run("main", 1000, stubCancelledNever),
            new Error("wrapped")
        )
    })

    test("Error Service E and D", async () => {
        const e: ServiceE = {
            transform(bFut) {
                return [new Promise((resolve, reject) => {
                    bFut.then(b => {
                        assert.equal(b, "resultB")
                        return setTimeout(() => reject(new Error('Service E failed')), DELAY);
                    }, reject)
                }), () => { }]
            },
            combine(aPromise, cPromise) {
                return [(async () => {
                    const [a, c] = await Promise.all([aPromise, cPromise]);
                    return new Promise((resolve, reject) => setTimeout(() => reject(new Error('Service E failed')), DELAY));
                })(), () => { }]
            }
        }
        const d: ServiceD = {
            async merge(a, b) {
                assert.equal(a, "resultA")
                assert.equal(b, "resultB")
                return new Promise((resolve, reject) => setTimeout(() => reject(new Error("Service D failed")), DELAY))
            }
        }
        const errorMapper = {
            aborted: () => new Error("aborted"),
            timedOut: () => new Error("timedOut"),
            error: async () => new Error("wrapped"),
        }
        const sut = createSUT({ a, b, c, d, e, f, errorMapper })
        assert.rejects(
            sut.run("main", 1000, stubCancelledNever),
            new Error("wrapped")
        )
    })

    test("Aborting", async () => {
        let timestamp = Date.now();
        const aAbort = mock.fn();
        const a: ServiceA = {
            start(req) {
                assert.equal(req, "main")
                timestamp = Date.now();
                return "tokenA"
            },
            poll(tok) {
                assert.equal(tok, "tokenA")
                return Date.now() > timestamp + DELAY ? "resultA" : null
            },
            abort: aAbort
        }
        const b: ServiceB = {
            submit(req, isCancelled, timeout, callback) {
                setTimeout(() => assert.strictEqual(isCancelled(), false), 90)
                setTimeout(() => assert.strictEqual(isCancelled(), true), 110)
                setTimeout(() => callback(undefined, "resultB"), DELAY)
            }
        }
        const eTransformAbort = mock.fn();
        const eCombineAbort = mock.fn();
        const e: ServiceE = {
            transform(bFut) {
                return [new Promise((resolve, reject) => {
                    bFut.then(b => {
                        assert.equal(b, "resultB")
                        return setTimeout(() => resolve("resultE"), DELAY);
                    }, reject)
                }), eTransformAbort]
            },
            combine(aPromise, cPromise) {
                return [(async () => {
                    const [a, c] = await Promise.all([aPromise, cPromise]);
                    return new Promise((resolve) => setTimeout(() => resolve("resultE"), DELAY));
                })(), eCombineAbort]
            }
        }

        const sut = createSUT({ a, b, c, d, e, f })
        await assert.rejects(
            async () => {
                let canceled = false;
                const listeners: Array<() => void> = [];
                const onCancelled = (listener: () => void) => {
                    listeners.push(listener);
                };
                const promise = sut.run("main", 1000, { isCancelled: () => canceled, onCancelled });
                setTimeout(() => {
                    canceled = true;
                    listeners.forEach((listener: () => void) => {
                        listener();
                    })
                }, 100);
                await promise;
            },
            new Error("aborted")
        )
        assert.strictEqual(aAbort.mock.calls.length, 2);
        assert.strictEqual(eCombineAbort.mock.calls.length, 1);
        assert.strictEqual(eTransformAbort.mock.calls.length, 1);
        // Wait for after abort assertions
        await new Promise((resolve) => setTimeout(resolve, 50));
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
