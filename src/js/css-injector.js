class CssInjector {

}

CssInjector.main = `
    /* hide the vertical ad bar */
    ._1K0cujP_EBzCd77bTesW1q {
        display: none !important;
    }

    /* hide the small ad bar in other email page */
    ._1WwQwMPzid8CW9R22noJq6 {
        display: none !important;
    }

    /* hide the upgrade premium ad bar */
    ._1x0NRQ4xIoC0ZaTr2yjnJc {
        display: none !important;
    }

    /* make the header higher and dragable */
    ._3fpgaLm7NwXSzB_ETFcCNj {
        padding-top: 30px !important;
        -webkit-app-region: drag;
    }

    /* make the clickable component in header not dragable */
    ._3nKSQcmZjHV3x2jl9xjqWj._2S-r1xigq2rKITZQs-EiCV,
    ._3w0vuS2NulbHxhF122Um_L,
    .ms-FocusZone._2UyyMXJKZ_eKg5jzcJFAbN {
        -webkit-app-region: no-drag;
    }
`

module.exports = CssInjector