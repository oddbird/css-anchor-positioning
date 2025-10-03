# .devcontainer

This container is not strictly necessary for regular development. It was added while debugging an issue with the browser tests that happened on GitHub Actions. Use it if you need it.

[This getting-started guide](https://code.visualstudio.com/docs/devcontainers/tutorial) (you can stop after installing the extension) takes you through using a dev container for the first time.

Once you've installed the extension you may see a popup asking you if you want to reopen the current directory in a devcontainer. Click yes.

If you missed it, look for the icon in the bottom left of the status bar that looks like kind of like `>` and `<` next to each other and click that.

Choose Reopen in container from the menu.

## First-time setup

The first time will be a bit slow as you download the base image.

Open a terminal in VS Code once it reopens the project in a new devcontainer-powered window.
The dev container is running Ubuntu as the root user.

To install additional tools via `apt`, first run `apt update`.

```sh
apt update
```

Next, install `curl`.

```sh
apt install curl
```

Now follow the instructions on Nodejs.org for [installing Node on Linux using `nvm`](https://nodejs.org/en/download).

You'll need some browsers and dependencies for Playwright:

```sh
npx playwright install --with-deps
```

Finally, install dependencies:

```sh
npm clean-install
```

Optional: confirm tests pass inside the container.

```sh
NODE_OPTIONS=--no-experimental-strip-types npm run test:ci
```
