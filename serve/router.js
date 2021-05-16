
const Router = require('koa-router')

const router = new Router()

router.get('/',async function(ctx){
    let html = `
      hell world
    `
  ctx.body = html
})


module.exports = router