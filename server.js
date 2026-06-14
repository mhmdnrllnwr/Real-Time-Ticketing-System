const ex=require('express'),app=ex(),srv=require('http').createServer(app),io=require('socket.io')(srv),L=new Map();
app.use(ex.static('public'));
io.on('connection',s=>{
  s.emit('init',[...L.keys()]);
  s.on('lock',i=>{if(L.has(i))return s.emit('err','Seat taken!');L.set(i,s.id);s.broadcast.emit('locked',i);s.emit('ok',i)});
  s.on('unlock',i=>{if(L.get(i)===s.id){L.delete(i);io.emit('free',i)}});
});
srv.listen(3000,()=>console.log('Running on port 3000'));