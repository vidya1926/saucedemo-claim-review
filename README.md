# SauceDemo UI Test Claim Review

The research prototype and its analyzer, visualizer, fixtures, tests, and usage instructions are in [`saucedemo-research/`](saucedemo-research/README.md). That folder is the only maintained application and test suite in this repository.

To run it:

```sh
cd saucedemo-research
npm install
npm test
npm run typecheck
```

See the standalone project README for local visualizer and Playwright browser-test instructions, plus the prototype's limitations. Browser pass/fail is not treated as ground truth for behavioral claims.

The repository also contains the thesis manuscript, proposal, and presentation materials. The analyzer is a research aid; it does not itself decide whether a claim is hallucinated.
