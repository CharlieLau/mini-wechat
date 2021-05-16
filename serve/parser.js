const path = require('path')
const execFile = require('child_process').execFile
const util = require('./util')
const cache  = require('./cache')
const wxmlTranspiler = require('wxml-transpiler')
const wxssSourcemap = require('./wxss')

const wcscMac = path.resolve(__dirname, '../bin/wcsc')
const wccMac = path.resolve(__dirname, '../bin/wcc')

const wxssArgs = ['-lc'] //, '-db'这个参数貌似跟sourcemap相关，用wine跑的时偶尔会报错，所以不用
const wxmlArgs = ['-d']

module.exports = (fullPath)=>{
    fullPath = fullPath.replace(/^\.?\//, '')
    return new Promise((resolve,reject)=>{
        if (cache.get(fullPath)) {
            return resolve(cache.get(fullPath))
        }
        if(/\.wxss/.test(fullPath)){
            parseImports(fullPath,true,(err,srcs)=>{
                if (err) return reject(err)
                cache.setWxssMap(srcs)
                let execWcsc = execFile.bind(null, wcscMac, wxssArgs.concat(srcs))
                execWcsc({ maxBuffer: 1024 * 600 }, (err, stdout, stderr) => {
                    if (err) {
                      console.error(err.stack)
                      return reject(new Error(`${fullPath} 编译失败，请检查`))
                    }
                    wxssSourcemap(fullPath, stdout).then(content => {
                      cache.set(fullPath, content)
                      resolve(content)
                    }, reject)
                })
            })
        }else if (/\.wxml/.test(fullPath)){
            parseImports(fullPath,true,(err,srcs)=>{
                if (err) return reject(err)
                const wxmlCmpRes = wxmlTranspiler.wxmlCompile(srcs)
                const tagsInCode = wxmlCmpRes.tags
                let execWcc = execFile.bind(null, wccMac, wxmlArgs.concat(srcs))
                execWcc({ maxBuffer: 1024 * 600 }, (err, stdout, stderr) => {
                    if (err) {
                      console.error(err.stack)
                      return reject(new Error(`${fullPath} 编译失败，请检查`))
                    }
                    const res = [stdout, tagsInCode]
                    cache.set(fullPath, res)
                    resolve(res)
                })
            })
        }
    })
}

function parseImports (file, wxss, cb) {
    let fn = wxss ? 'parseCssImports' : 'parseImports'
    let srcs = []
    util[fn](srcs, file, function (err) {
      if (err) {
        console.error(file + '=> ParseImports Error <=' + err)
        return cb(err)
      }
      srcs.unshift(file)
      return cb(null, srcs.map(src => `./${src}`))
    })
  }