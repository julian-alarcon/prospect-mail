class CssInjector {

}

CssInjector.main = `
    /* hide the vertical ad bar */
    ._2qPmszDwBfYpF7PO9Mn3KN {
        display: none !important;
    }

    /* hide the small ad bar in other email page */
    .JW6biuVNNJGdDTU7t1DWd {
        display: none !important;
    }

    /* hide the upgrade premium ad bar */
    ._20YsfelFmugQWgNkXdkYaF {
        display: none !important;
    }

    /* make the header higher and dragable */
    ._2SETNF5hlFf4JfNCfzGXnh {
        padding-top: 30px !important;
        -webkit-app-region: drag;
    }

    /* make the clickable component in header not dragable */
    .iAvecXA_GRQH_AAGS1qhn._2SvWF44TZgwj95spKJn8Za,
    ._3K7KyMzCPUsIHPTKX-Q7PD,
    .ms-FocusZone._2heo7Eue0oDeyWNI4XaGWZ {
        -webkit-app-region: no-drag;
    }
`

module.exports = CssInjector