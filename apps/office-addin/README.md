# KlickerUZH PowerPoint Content Add-in
This repository contains the KlickerUZH content add-in for Microsoft PowerPoint

## Local development using npm

_Important:_
It is strongly recommended that you develop PowerPoint add-ins on a Windows machine with the desktop app for PowerPoint installed. This way you can use automatic sideloading for development (see [below](#sideloading)) which is by far the most convenient way to develop an Office add-in. If you want develop these add-ins in PowerPoint on the web, check [this site](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/sideload-office-add-ins-for-testing#sideload-a-yeoman-created-add-in-to-office-on-the-web). You might also have to adapt the scripts in `package.json` to be able to work with both add-ins at the same time. However, be aware that add-ins tend to work not as well when sideloaded on the web.

### Requirements
- npm
- Node.js

### Sideloading

The project is setup using the [Yeoman generator for Office Add-ins](https://github.com/OfficeDev/generator-office).

Start by cloning this repository. After navigating inside the folder containing this project, run the following command:

```sh
npm install
```
This installs the necessary packages for the add-in. You can then sideload both add-ins at the same time by running:

```sh
npm run dev
```

This command starts the development server and automatically sideloads the add-ins in their host application (PowerPoint). When you do this for the first time, you might see a prompt to install a security certificate. Agree and continue. The desktop app for your add-ins (PowerPoint) should start automatically and the add-ins should now appear in the list of all add-ins you have installed (the initial loading might take a moment). Auto-reloading of the source code is enabled by default. Since we are sideloading two add-ins at the same time, to instances of PowerPoint might open. You can close one of them.

Before the dev server starts, a custom script runs to clear the office cache. Please be aware that this will fail if you have any Office application currently open on your computer.

_Attention:_ While the taskpane add-in comes with a custom button in the ribbon that should appear after the add-in is fully loaded, the content add-in does not have a custom button on the ribbon. When the add-in gets sideloaded, an instance of the add-in is automatically inserted in the first slide. You can keep this or delete it. You can add more instances of the content add-in on the same or different slides by clicking on `Insert>My Add-ins>ADDIN-NAME`.

To stop the development server, interrupt the current process and then run

```sh
npm run stop
```

### Useful hints:
- Depending on the type of changes you make, you might not see them reflected in the add-in immediately. Even though auto-reloading is enabled, some files get cached and changes to the source code don't apply automatically.
- This is why the cache is cleared automatically whenever you start the dev server.
- To clear the cache manually, stop the development server and clear the Office cache, either by following [these instructions](https://docs.microsoft.com/en-us/office/dev/add-ins/testing/clear-cache) or by running the script `clear.bat`:

```sh
npm run clear
```
- Note that all Office host applications like Outlook, Word etc. need to be closed when you clear the cache, otherwise clearing the cache is not possible.
- When developing on the web, don't forget to clear your browser's cache.
- When you stopped the dev server, wait for a while before you start it again. The waiting is necessary as it takes the server a while to properly stop, even when it seems that the process is already finished. If you don't wait long enough, the dev server won't restart.
