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
    /* make the header higher and dragable */
    ._1Kg3ffZABPxXxDqcmoxkBA {
        padding-top: 30px !important;
        -webkit-app-region: drag;
    }

    /* make the clickable component in header not dragable */
    .ms-FocusZone,
    ._3Nd2PGu67wifhuPZp2Sfj5 {
        -webkit-app-region: no-drag;
    }
`

module.exports = CssInjector