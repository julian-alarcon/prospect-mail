class CssInjector {

}

CssInjector.main = `
    /* hide the vertical ad bar */
    ._1_ag99JsBHxI6S4FP5ayPv {
        display: none !important;
    }

    /* hide the small ad bar in other email page */
    ._2a6h2L3Tl12cnq2P7ZG9y_ {
        display: none !important;
    }

    /* hide the upgrade premium ad bar */
    ._1ZEdP0-JdMOVtjBb5ZcM6M {
        display: none !important;
    }
`

CssInjector.noFrame = `
    #owaSearchScopePicker_container {
        -webkit-app-region: drag;
    }

    #owaSearchBox_container {
        -webkit-app-region: drag;
    }

    #toDoSearchBox {
        -webkit-app-region: drag;
    }


    .tasksToolbar-top,
    .ms-CommandBar-primaryCommand {
        -webkit-app-region: drag;
    }

    ._2wgOIpe6drlPY4DYzFgM0J {
        -webkit-app-region: drag;
    }

    #searchBoxColumnContainerId {
        -webkit-app-region: no-drag;
    }

    .searchToolbar-icon.search {
        -webkit-app-region: no-drag;
    }

    .ms-SearchBox {
        -webkit-app-region: no-drag;
    }

    /* make the clickable component in header not dragable */
    .ms-FocusZone,
    .ms-Button,
    .ms-TooltipHost,
    .tasksToolbar-actions,
    ._3Nd2PGu67wifhuPZp2Sfj5 {
        -webkit-app-region: no-drag;
    }
`

module.exports = CssInjector