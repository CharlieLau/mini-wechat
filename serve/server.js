
const koa = require('koa')
const compress = require('koa-compress')
const http = require('http')
const app = new koa();
const router = require('./router')


module.exports = (rootPath)=>{
    app.use(compress({
        threshold: 2048,
        flush: require('zlib').Z_SYNC_FLUSH
    }))

    app.use(router.routes())
    app.use(router.allowedMethods())

    app.use(require('koa-static')(rootPath, {
        maxage: module.parent ? 1296000000 : 0
    }))
    return http.createServer(app.callback())
}