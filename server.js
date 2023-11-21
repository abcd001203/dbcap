const express = require('express');
const session = require('express-session');
const multer = require('multer');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const fs = require('fs');
const uploadDir = 'uploads/';

// uploads 디렉터리가 없으면 생성
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }

const app = express();
app.set('port',3000);

//로그인 결과 저장을 위함
app.use(session({
	secret: 'secret',
	resave: false,
	saveUninitialized: true,
    store: new session.MemoryStore(),
}));
// Express에 EJS를 설정
app.set('views', 'my');
// app.set('views', path.join(__dirname, '/my'));
app.set('view engine','ejs'); 
//서버에서 정적 파일 제공 설정
app.use('/uploads', express.static(__dirname + '/uploads'));

// MySQL 연결 설정
const connection = mysql.createConnection({
    host: '127.0.0.1',
    user: 'dbcap',
    password: 'dbcap123',
    database: 'hansurvey',
    port: 3307 // 데이터베이스 포트
});

// Express에 bodyParser 미들웨어 추가
app.use(bodyParser.urlencoded({ extended: true }));
// 서버 시작
app.listen(app.get('port'), () => {
    console.log('서버가 http://localhost:'+app.get('port')+' 에서 실행 중입니다.');
});

// Multer 설정
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/'); // 이미지가 저장될 디렉토리
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + '-' + file.originalname); // 파일명 생성
    }
  });
  
const upload = multer({ storage: storage });



/////////회원가입 기능
app.get('/register', (req, res) => {
    res.sendFile(__dirname + '/join.html');
});
app.post('/register',(req,res) => {

    //html의 값을 가져옴
    let id=req.body.studentId;
    let name=req.body.name;
    let password = req.body.currentPassword;
    let password2 = req.body.confirmPassword;
    let grade = req.body.grade;
    let dep = req.body.dep;
    let major = req.body.major;
    if(dep!=""&&major!=""){
        if(password!=password2){
            res.send('<script type="text/javascript">alert("비밀번호가 다릅니다."); document.location.href="/register";</script>');
        }else{
            connection.query('SELECT * FROM user WHERE id=?;',[id],function(error,results){
                if (error) throw error;
                if(results.length<=0){
                    connection.query('INSERT INTO user (id, name, password, grade, dep, major) VALUES (?, ?, ?, ?, ?, ?);', [id, name, password, grade, dep, major], function(error)  {
                        if (error) {
                           console.error('쿼리 실행 오류:', error);
                            res.send('<script type="text/javascript">alert("쿼리 실행 오류"); document.location.href="/register";</script>');
                        } else {
                            console.log('데이터베이스에 회원이 등록되었습니다.');
                            res.send('<script type="text/javascript">alert("회원가입을 환영합니다!"); document.location.href="/register";</script>');
                        }
                    });
                } else{
                    res.send('<script type="text/javascript">alert("이미 존재하는 학번입니다."); document.location.href="/register";</script>');
                }
            });
        }
    } else {
        res.send('<script type="text/javascript">alert("학부와 전공을 선택해주세요."); document.location.href="/register";</script>');
    }
});

//////////로그인 기능
app.get('/login', (req, res) => {
    res.sendFile(__dirname + '/login.html');
});
app.post('/login',(req,res) => {
    let id=req.body.id;
    let password = req.body.password;

    connection.query('SELECT id,password,name FROM user WHERE id=? AND password = ?;',[id,password], function(error,results){
        if (error) throw error;
        if(results.length<=0){
            res.send('<script type="text/javascript">alert("로그인 정보가 올바르지 않습니다."); document.location.href="/login";</script>');
        } else{
            req.session.loggedin = true;
            req.session.userID = id
            res.send('<script type="text/javascript">alert("'+[results[0].name]+'님 환영합니다."); document.location.href="/mypage";</script>');
            ;
        }
    });
});

////////로그아웃 기능
app.get('/logout', function(req, res) {
	req.session.loggedin = false;
	res.send('<script type="text/javascript">alert("성공적으로 로그아웃 되었습니다."); document.location.href="/login";</script>');	
  });

//////마이페이지
app.get('/mypage', (req, res) => {
    if(req.session.loggedin){
        let id=req.session.userID;
        connection.query('SELECT * FROM user WHERE id=?;',[id], function(error,results){
            if (error) throw error;
            res.render('mypage', { data: results[0] });
        });
    } else{
        res.send('<script type="text/javascript">alert("로그인이 필요합니다."); document.location.href="/login";</script>');
    }
   
});
//////회원정보 수정
app.get('/my_updateinfo', (req, res) => {
    if(req.session.loggedin){
        let id=req.session.userID;
        connection.query('SELECT * FROM user WHERE id=?;',[id], function(error,results){
            res.render('my_updateinfo', { data: results[0] });
        });
    } else{
        res.send('<script type="text/javascript">alert("로그인이 필요합니다."); document.location.href="/login";</script>');
    }
});
app.post('/my_updateinfo',(req,res) => {
    let id=req.session.userID;
    let name = req.body.name;
    let password = req.body.currentPassword;
    let grade = req.body.grade;
    let dep = req.body.dep;
    let major = req.body.major;

    if(password){
        connection.query('SELECT password FROM user WHERE id=?;',[id],function(error,results){
            if(error)throw error;
            if(results[0]==password){
                connection.query('UPDATE user SET name=?, grade=?, dep=?, major=? WHERE id=?;',[name,grade,dep,major,id],function(error){
                    if(error)throw error;
                    res.send('<script type="text/javascript">alert("회원정보가 수정되었습니다."); document.location.href="/mypage";</script>');
                });
            }else{
                res.send('<script type="text/javascript">alert("비밀번호가 맞지 않습니다."); document.location.href="/my_updateinfo";</script>');
            }
        });
        
    }else{
        res.send('<script type="text/javascript">alert("비밀번호를 입력해주세요."); document.location.href="/my_updateinfo";</script>');
    }

});
//////비밀번호 수정
app.get('/my_updatePW', (req, res) => {
    if(req.session.loggedin){
        let id=req.session.userID;
        connection.query('SELECT * FROM user WHERE id=?;',[id], function(error,results){
            res.render('my_updatePW', { data: results[0] });
        });
    } else{
        res.send('<script type="text/javascript">alert("로그인이 필요합니다."); document.location.href="/login";</script>');
    }
});
app.post('/my_updatePW',(req,res) => {
    let id=req.session.userID;
    let currentPW = req.body.currentPassword;
    let updatePW =req.body.updatePassword;
    let confirmPW=req.body.confirmPassword;

    if(updatePW==confirmPW){
        connection.query('SELECT password FROM user WHERE id= ?;',[id],function(error,results){
            if(error)throw error;
            if(results[0].password==currentPW){
                connection.query('UPDATE user SET password =? WHERE id=?;',[updatePW,id],function(error){
                    if(error)throw error;
                    res.send('<script type="text/javascript">alert("비밀번호가 수정되었습니다."); document.location.href="/my_updatePW";</script>');
                });
            }else{
                res.send('<script type="text/javascript">alert("현재 비밀번호가 맞지 않습니다."); document.location.href="/my_updatePW";</script>');
            }
        });
    }else{
        res.send('<script type="text/javascript">alert("비밀번호가 같지 않습니다."); document.location.href="/my_updatePW";</script>');
    }
});
/////설문 등록
app.get('/upload', (req, res) => {
    if(req.session.loggedin){
        let id=req.session.userID;
        connection.query('SELECT * FROM user WHERE id=?;',[id], function(error,results){
            res.render('upload', { data: results[0] });
        });
    } else{
        res.send('<script type="text/javascript">alert("로그인이 필요합니다."); document.location.href="/login";</script>');
    }
});
app.post('/upload',  upload.single('thumbnail'), (req,res) => {
    let id=req.session.userID;
    let sur_title = req.body.sur_title;
    let sur_link =req.body.sur_link;
    let sur_content=req.body.sur_content;
    let thumbnail=req.file.path;
    let start_date=req.body.st_date;
    let end_date=req.body.end_date;

    if(sur_title&&sur_link&&sur_content&&start_date&&end_date&&thumbnail){
        if(start_date>end_date){
            res.send('<script type="text/javascript">alert("종료일이 시작일보다 빠릅니다.");</script>');
        }else{
            connection.query('INSERT INTO survey (reg_id, sur_title, sur_link, sur_content, thumbnail, start_date, end_date, condi) VALUES (?, ?, ?, ?, ?, ?, ?, 0);'
            , [id, sur_title,sur_link,sur_content,thumbnail,start_date,end_date], function(error){
                if(error)throw error;
                res.send('<script type="text/javascript">alert("설문이 등록되었습니다."); document.location.href="/upload";</script>');
            });
        }
    }else{
        res.send('<script type="text/javascript">alert("누락된 항목이 있습니다.");</script>');
    }

   
});
//////내 설문 목록
app.get('/my_survey_list', (req, res) => {
    if(req.session.loggedin){
        let id=req.session.userID;
        connection.query('SELECT * FROM survey,user WHERE survey.reg_id=? AND user.id=?;',[id,id], function(error,results){
            if(results.length<=0){
                res.send('<script type="text/javascript">alert("등록한 설문조사가 없습니다.");document.location.href="/mypage"</script>');
            }else{
                res.render('my_survey_list', { data: results});
            }
            
        });
    } else{
        res.send('<script type="text/javascript">alert("로그인이 필요합니다."); document.location.href="/login";</script>');
    }
});
//이미지 연동
app.get('/logo', (req, res) => {
    res.sendFile(__dirname + "/img/logo.jpg");
});
app.get('/univ', (req, res) => {
    res.sendFile(__dirname + "/img/univ.jpg");
});
app.get('/dawn', (req, res) => {
    res.sendFile(__dirname + "/img/dawn.jpg");
});