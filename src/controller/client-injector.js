const path = require('path')
const fs = require('fs')

const cache = {}
module.exports = (relpath) => {    
    if (cache[relpath])
    {
        return cache[relpath]
    }
    relpath = relpath.trim()
    //remove initial . or / to prevent out of bound request
    while (['/', '.'].indexOf(relpath.substring(0, 1)) == 0) relpath = relpath.substring(1)    
    const fullpath = path.resolve(path.join(__dirname,'../../public', relpath))
    if (!fs.existsSync(fullpath) || !fs.statSync(fullpath).isFile()) {
        throw new Error(`${relpath} is not a valid client file. It must exists in ` + fullpath)
    }
    console.log(`Prepare %o to be injected.`, relpath)
    cache[relpath] = fs.readFileSync(`${fullpath}`).toString()
    return cache[relpath]
}