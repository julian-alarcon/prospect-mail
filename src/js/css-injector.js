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

    /* Some new Outlook good stuff */
    .ms-Button--commandBar.root-55 {
        border-radius: 6px !important;
        padding: 1em;
    }

    div[role="treeitem"]:not(.taskItem) {
        max-height: 28px !important;
    }

    /* Email List */

    ._1y3FkDsOHuxLnfkzQ8Dx7o {
        font-weight: 700;
    }

    .NsB53xFTU532cgP0ztFSC {
        margin-bottom: 2px !important;
    }

    ._2xkBpjoOewQl-YKzYlwpxg,
    .ms-Persona-imageArea,
    .ms-Image.ms-Persona-image {
        min-width: 40px;
        min-height: 40px;   
    }

    .ms-Persona-initials,
    .ms-Persona-initials span {
        height: 100% !important;
    } 
    
    .ms-Persona--size28 .ms-Persona-initials span {
        line-height: 40px;
        font-size: 16px;
    }

    /* Round corners */

    ._3TShXKcugWppOYRofyKkhd,
    ._12R4Y5HY4asDLcTre4Gwl7 {
        margin: .5em .5em 0 .5em;
        background-color: white;
        border-top-left-radius: 15px;
        border-top-right-radius: 15px;
    }

    ._12R4Y5HY4asDLcTre4Gwl7 {
        margin-right: 1em;
    }


    ._3TShXKcugWppOYRofyKkhd {
        background-color: white !important;
        border-right: 0px none;
    }

    ._1mmhFz6xbEHFv6FfTUKPW2 {
        border-right: 0px solid transparent !important;
    }

    .w4T91TVJrRh9QNUdePUM0,
    ._1qPqjoFrRhZTOpwH-IJ2UP {
        border-bottom: 0px solid transparent !important;
    }

    .LXc0AFtlSiX4R6aYow6BV {
        background-color: white !important;
    }

    ._1jvp4Dqet20DWUHHs5mtWB._3H-aDJS5lve7ygwD0TXE6R._1Gd6viaptR7BjyUckf-7kV {
        background-color: var(--neutralLighter); 
    }

    ._3BL964mseejjC_nzEeda9o.NN4ve7-zXI11J6Er51ULd,
    ._18Sy4grXNeT6XfdUGN6qj._1d4W1bELFYuIyU_AtxkKXV,
    ._18Sy4grXNeT6XfdUGN6qj,
    ._3BL964mseejjC_nzEeda9o {
        border-radius: 15px !important;
    }

    /* Side Bar */

    ._3FRkQCaW93U6_E5AiycKCb {
        background-color: var(--neutralLighter);
    }

    #O365fpcontainerid,
    .o365cs-base ._3-OAdjOsC9dPcCbWyqlP7E:not(:-webkit-any-link) {
        border-top-left-radius: 15px;
    }

    #O365fpcontainerid {
        top: 50px !important;
        box-shadow: none !important;
    }

    #O365fpcontainerid button {
        border-radius: 5px;
    }

    #FlexPane_OwaTimePanel {
        padding-left: 10px;
    }

    ._2FUcIOFrpfKDLRAOeLwVBq {
        height: calc(100vh - 163px) !important;
    }

    ._3A5noZ4y9VM6UYGLFZCTCX,
    .vbF-r-E4avKj8URfLkl17,
    #O365fpcontainerid {
        width: 375px !important;
    }

    .JynaKKC7xqWxfN04-DU1m {
        width: 80% !important;
    }

    .JynaKKC7xqWxfN04-DU1m th {
        font-weight: bold;
    }

    .ms-Check.eYRooDpyKCmxyN4LdWjLa._3uDKZZbosbt_MutV5HLmnr {
        margin: 11px;
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