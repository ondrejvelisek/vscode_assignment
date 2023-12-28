# VSCode Extension

Write vscode extension which shows number of xml files present in current workspace inside statusbar:
* The status bar item updates automatically when files inside the workspace change.
* To determine if something is an XML file it is enough to inspect its file extension.
* See `xml_extension.png` for example of expected behavior of the extension.
Provide automated tests demonstrating how your extension satisfies these requirements.
Provide instructions for how to run your extension from source inside vscode, no need to package it as .vsix file.

# Node and Service Composition

Implement `ServiceComposition` in `serviceComposition.ts` such that following constraints are met:
* Invocation of `run` never blocks the calling thread longer than 100ms.
* If there is some way the `run` could return successfuly before the timeout expires it needs to keep trying to complete the request.
  In particular assume these are all valid paths your implementation may take to obtain the desired result:
  * `(A + B) -> D`  meaning call service A and service B, use their results to call service D, which returns the desired result
  * `((B -> E) + C) -> F`
  * `(((A + C) -> E) + C) -> F`
* If some errors occurred during the `run` and success is not reached within timeout all of the collected errors
  need to be mapped by `ErrorMapper.error()` when the timeout expires and the produced `Error` is thrown by the returned promise
* If user decided to abort the request (signalised by the `cancellationToken` passed to `run`) the returned promise
  should be rejected by `ErrorMapper.aborted()` and any outstanding requests to the backend services should also be aborted where possible
* If there were no errors the returned promise needs to be rejected by `ErrorMapper.timedOut()` 
  once the timeout (given by parameter `duration` passed to `run`) expires

Implement automated test suite for your implementation:
* Make sure your implementation satisfies tests in `serviceComposition.test.ts`. 
* These tests use mocha in the `tdd` flavor, if you prefer different test runner/framework feel free to adapt the tests as required.
* Provide more tests of your own which demonstrate how your implementation satisfies the requirements above.

Code of this assignment needs to be in typescript:
* Provide script which builds (i.e. transforms your typescript sources into executable javascript) the code.
* Provide script which runs your automated tests.
* You can use simple npm scripts (e.g. `npm run build` and `npm run test`),
  but if you are more familiar with other form (e.g. using gulp) feel free to use that.