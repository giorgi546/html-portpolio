const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_FILE = path.join(__dirname, 'database.json');
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');

function loadDB(){
  if(!fs.existsSync(DB_FILE)){
    const roles=[{id:1,name:'admin'},{id:2,name:'user'}];
    fs.writeFileSync(DB_FILE, JSON.stringify({users:[],roles:roles,userRoles:[],files:[],sessions:{}}));
  }
  return JSON.parse(fs.readFileSync(DB_FILE));
}
function saveDB(db){fs.writeFileSync(DB_FILE, JSON.stringify(db));}

function sendFile(res,filePath){
  fs.readFile(filePath,(err,data)=>{
    if(err){res.writeHead(404);res.end('Not Found');return;}
    const ext=path.extname(filePath).slice(1);
    const map={html:'text/html',css:'text/css',js:'application/javascript',png:'image/png',jpg:'image/jpeg'};
    res.writeHead(200,{"Content-Type":map[ext]||'text/plain'});res.end(data);
  });
}

function parseBody(req){
  return new Promise((resolve)=>{
    let data='';
    req.on('data',chunk=>data+=chunk);
    req.on('end',()=>{
      try{resolve(JSON.parse(data));}catch{resolve({});}
    });
  });
}

function auth(req){
  const cookie=req.headers.cookie||'';
  const match=/session=([^;]+)/.exec(cookie);
  if(match){
    const db=loadDB();
    const sess=db.sessions[match[1]];
    if(sess){
      const user=db.users.find(u=>u.id===sess.userId);
      return user;
    }
  }
  return null;
}

http.createServer(async (req,res)=>{
  if(req.method==='GET'&&req.url.startsWith('/api/')){
    const user=auth(req);
    if(req.url==='/api/files'&&user){
      const db=loadDB();
      const files=db.files.filter(f=>f.userId===user.id);
      res.writeHead(200,{"Content-Type":"application/json"});res.end(JSON.stringify(files));return;
    }
    res.writeHead(401);res.end('Unauthorized');return;
  }
  if(req.method==='POST'&&req.url==='/api/register'){
    const body=await parseBody(req);
    const db=loadDB();
    if(db.users.find(u=>u.email===body.email)){res.writeHead(400);res.end(JSON.stringify({message:'Exists'}));return;}
    const id=db.users.length+1;
    const pass=crypto.createHash('sha256').update(body.password).digest('hex');
    db.users.push({id,email:body.email,password:pass});
    const roleId=db.users.length===1?1:2;
    db.userRoles.push({userId:id,roleId});
    saveDB(db);
    res.writeHead(200,{"Content-Type":"application/json"});res.end(JSON.stringify({message:'Registered'}));return;
  }
  if(req.method==='POST'&&req.url==='/api/login'){
    const body=await parseBody(req);
    const db=loadDB();
    const user=db.users.find(u=>u.email===body.email);
    const pass=crypto.createHash('sha256').update(body.password).digest('hex');
    if(user&&user.password===pass){
      const token=crypto.randomBytes(16).toString('hex');
      db.sessions[token]={userId:user.id};
      saveDB(db);
      res.writeHead(200,{"Content-Type":"application/json","Set-Cookie":`session=${token}; HttpOnly`});
      res.end(JSON.stringify({message:'Logged in',success:true}));return;
    }
    res.writeHead(400,{"Content-Type":"application/json"});res.end(JSON.stringify({message:'Invalid'}));return;
  }
  if(req.method==='POST'&&req.url==='/api/upload'){
    const user=auth(req);if(!user){res.writeHead(401);res.end();return;}
    const body=await parseBody(req);
    const base64=body.content.split(',')[1];
    const buffer=Buffer.from(base64,'base64');
    const filepath=path.join(UPLOAD_DIR,body.filename);
    fs.writeFileSync(filepath,buffer);
    const db=loadDB();
    db.files.push({id:db.files.length+1,userId:user.id,filename:body.filename});
    saveDB(db);
    res.writeHead(200,{"Content-Type":"application/json"});res.end(JSON.stringify({message:'Uploaded'}));return;
  }
  // static files
  const filePath=path.join(__dirname,'public',req.url==='/'?'index.html':req.url);
  if(fs.existsSync(filePath)&&fs.statSync(filePath).isFile()){
    return sendFile(res,filePath);
  }
  res.writeHead(404);res.end('Not Found');
}).listen(3000,()=>console.log('Server running on http://localhost:3000'));
