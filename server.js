const express = require('express');
const session = require('express-session');
const multer = require('multer');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const fs = require('fs');
const { error } = require('console');
const uploadDir = 'uploads/';

//uploads 디렉터리가 없으면 생성
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
app.set('views', 'pages');
// app.set('views', path.join(__dirname, '/my'));
app.set('view engine','ejs'); 
//서버에 정적 파일 제공 설정
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

// 이미지 저장을 위한 Multer 설정
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
            req.session.userID = id;
            if(id=='admin'){
                req.session.authority = true;
                res.send('<script type="text/javascript">alert("'+[results[0].name]+'님 환영합니다."); document.location.href="/adm_main";</script>');
            }else{
                res.send('<script type="text/javascript">alert("'+[results[0].name]+'님 환영합니다."); document.location.href="/main";</script>');
            }
        }
    });
});

////////로그아웃 기능
app.get('/logout', function(req, res) {
	req.session.loggedin = false;
    req.session.authority = false;
	res.send('<script> document.location.href="/login";</script>');	
  });

//////메인페이지
app.get('/main', (req, res) => {
    if(req.session.loggedin){
        let id=req.session.userID;
        ////테스트 후 conid=1로 수정할 것
        connection.query('SELECT s.*, u.name FROM survey s JOIN user u ON s.reg_id = u.id WHERE s.condi = 1 AND s.start_date <= NOW() AND s.end_date >= NOW();'
        ,function(error,results){
            if (error) throw error;
            connection.query('SELECT name FROM user WHERE id=?;',[id],function(err,result){
                if (err) throw err;
                res.render('main', { data: results,name:result[0] });
            });
        });
    } else{
        res.send('<script type="text/javascript">alert("로그인이 필요합니다."); document.location.href="/login";</script>');
    }
});
//////메인페이지_설문 검색
app.get('/search', (req, res) => {
    if (req.session.loggedin) {
        let id=req.session.userID;
        let category = req.query.category;
        let searchValue = req.query.search;
        
        //카테고리 구분
        if (category === 'title') {
            sql_query = 'SELECT s.*, u.name FROM survey s JOIN user u ON s.reg_id = u.id WHERE s.condi = 1 AND s.start_date <= NOW() AND s.end_date >= NOW() AND s.sur_title LIKE ?;'
          } else if (category === 'author') {
            sql_query = 'SELECT s.*, u.name FROM survey s JOIN user u ON s.reg_id = u.id WHERE s.condi = 1 AND s.start_date <= NOW() AND s.end_date >= NOW() AND u.name LIKE ?;';
          }

      connection.query(sql_query, ['%'+searchValue+'%'], function(error,results) {
      if(error) throw error;
      connection.query('SELECT name FROM user WHERE id=?;',[id],function(err,result){
        if (err) throw err;
        res.render('main', { data: results,name:result[0] });
        });
    });
    } else {
      res.send('<script type="text/javascript">alert("로그인이 필요합니다."); document.location.href="/login";</script>');
    }
  });

//////설문 상세보기 페이지
app.get('/view_details/:reg_id/:sur_title', (req, res) => {
    if(req.session.loggedin){
        let reg_id=req.params.reg_id;
        let sur_title=req.params.sur_title;
        connection.query('SELECT survey.*,user.name FROM survey,user WHERE survey.reg_id= ? AND survey.sur_title= ? AND user.id=?;',[reg_id,sur_title,reg_id],function(error,results){
            if(error)throw error;
            res.render('view_details', { data: results[0] });
        })
    } else{
        res.send('<script type="text/javascript">alert("로그인이 필요합니다."); document.location.href="/login";</script>');
    }
   
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
            if(error)throw error;
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
    let start_date=req.body.st_date;
    let end_date=req.body.end_date;
    // 파일이 업로드되었는지 확인
    let thumbnail;
    if (req.file) {
        thumbnail = req.file.path;
    }

    if (start_date > end_date) {
        res.send('<script type="text/javascript">alert("종료일이 시작일보다 빠릅니다.");</script>');
    } else {
        // 파일이 업로드되었는지 여부에 따라 처리
        if (thumbnail) {
            connection.query("SELECT * FROM survey WHERE reg_id=? AND sur_title=?;", [id, sur_title], function (error, results) {
                if (error) throw error;
                if (results.length <= 0) {
                    connection.query('INSERT INTO survey (reg_id, sur_title, sur_link, sur_content, thumbnail, start_date, end_date, condi) VALUES (?, ?, ?, ?, ?, ?, ?, 0);',
                        [id, sur_title, sur_link, sur_content, thumbnail, start_date, end_date], function (error) {
                            if (error) throw error;
                            res.send('<script type="text/javascript">alert("설문이 등록되었습니다."); document.location.href="/upload";</script>');
                        });
                } else {
                    res.send('<script type="text/javascript">alert("이미 내가 등록한 제목입니다."); document.location.href="/upload";</script>');
                }
            });
        } else {
            res.send('<script type="text/javascript">alert("이미지를 첨부해주세요.");</script>');
        }
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

/////설문 수정
app.get('/update_survey/:sur_title', (req, res) => {
    let id=req.session.userID;
    let sur_title=req.params.sur_title;

    if(req.session.loggedin){
        connection.query('SELECT * FROM survey WHERE reg_id = ? AND sur_title = ?;',[id,sur_title], function(error,results) {
            if(error) throw error;
            if(results.length<=0){
                res.send('<script type="text/javascript">alert("등록한 설문조사가 없습니다.");</script>');
            }else{
                req.session.sur_title=sur_title;
                res.render('update_survey', { data: results[0]});
            }
        });

    }else{
        res.send('<script type="text/javascript">alert("로그인이 필요합니다."); document.location.href="/login";</script>');
    }
    
});
app.post('/update_survey',  upload.single('thumbnail'), (req,res) => {
    let id=req.session.userID;
    let current_sur_title = req.session.sur_title
    let new_sur_title = req.body.sur_title;
    let sur_link =req.body.sur_link;
    let sur_content=req.body.sur_content;
    let start_date=req.body.st_date;
    let end_date=req.body.end_date;
    //파일이 업로드되었는지 확인
    let thumbnail;
    if (req.file) {
        thumbnail = req.file.path;
    }
    if (start_date > end_date) {
        res.send('<script type="text/javascript">alert("종료일이 시작일보다 빠릅니다.");</script>');
    } else {
        // 파일이 업로드되었는지 여부에 따라 처리
        if (thumbnail) {
            connection.query('UPDATE survey SET sur_title=?, sur_link=?, sur_content=?, thumbnail=?, start_date=?, end_date=?, condi=? WHERE reg_id =? AND sur_title=?;'
                , [new_sur_title, sur_link, sur_content, thumbnail, start_date, end_date, 0, id, current_sur_title], function (error) {
                    if (error) throw error;
                    res.send('<script type="text/javascript">alert("설문이 수정되었습니다."); document.location.href="/my_survey_list";</script>');
                });
        } else {
            res.send('<script type="text/javascript">alert("이미지를 첨부해주세요.");</script>');
        }
    }
});

//////설문 삭제
app.get('/delet_survey/:sur_title', function(req, res) {
	let id=req.session.userID;
    let sur_title=req.params.sur_title;

    if(req.session.loggedin){
        connection.query('DELETE FROM survey WHERE reg_id=? AND sur_title=?;',[id,sur_title],function(error){
            if (error) throw error;
            res.send('<script type="text/javascript">alert("설문이 삭제되었습니다."); document.location.href="/my_survey_list";</script>');
        });
    }else{
        res.send('<script type="text/javascript">alert("로그인이 필요합니다."); document.location.href="/login";</script>');
    }
  });


//////관리자_메인페이지
app.get('/adm_main', (req, res) => {
    if(req.session.authority){
        if(req.session.loggedin){
            let id=req.session.userID;
            ////테스트 후 conid=1로 수정할 것
            connection.query('SELECT s.*, u.name FROM survey s JOIN user u ON s.reg_id = u.id WHERE s.condi = 1 AND s.start_date <= NOW() AND s.end_date >= NOW();'
            ,function(error,results){
                if (error) throw error;
                res.render('adm_main', { data: results,name:req.session.userID });
            });
        } else{
            res.send('<script type="text/javascript">alert("로그인이 필요합니다."); document.location.href="/login";</script>');
        }
    }else{
        res.send('<script type="text/javascript">alert("접근 권한이 없습니다.");</script>');
    }

});

//////관리자_메인페이지_설문 검색
app.get('/adm_search', (req, res) => {
    if (req.session.loggedin) {
        let id=req.session.userID;
        let category = req.query.category;
        let searchValue = req.query.search;
        
        //카테고리 구분
        if (category === 'title') {
            sql_query = 'SELECT s.*, u.name FROM survey s JOIN user u ON s.reg_id = u.id WHERE s.condi = 1 AND s.start_date <= NOW() AND s.end_date >= NOW() AND s.sur_title LIKE ?;'
          } else if (category === 'author') {
            sql_query = 'SELECT s.*, u.name FROM survey s JOIN user u ON s.reg_id = u.id WHERE s.condi = 1 AND s.start_date <= NOW() AND s.end_date >= NOW() AND u.name LIKE ?;';
          }

      connection.query(sql_query, ['%'+searchValue+'%'], function(error,results) {
      if(error) throw error;
      connection.query('SELECT name FROM user WHERE id=?;',[id],function(err,result){
        if (err) throw err;
        res.render('adm_main', { data: results,name:result[0] });
        });
    });
    } else {
      res.send('<script type="text/javascript">alert("로그인이 필요합니다."); document.location.href="/login";</script>');
    }
  });

/////관리자_설문 승인 페이지
app.get('/adm_approval', (req, res) => {
    if(req.session.authority){
        if(req.session.loggedin){
            let id=req.session.userID;
            connection.query('SELECT survey.*,user.name FROM survey,user WHERE survey.reg_id=user.id AND condi=0;', function(error,results){
                if(results.length<=0){
                    res.send('<script type="text/javascript">alert("승인 요청이 필요한 설문조사가 없습니다.");document.location.href="/adm_main"</script>');
                }else{
                    res.render('adm_approval', { data: results, name:req.session.userID});
                }
            });
        } else{
            res.send('<script type="text/javascript">alert("로그인이 필요합니다."); document.location.href="/login";</script>');
        }
    }else{
        res.send('<script type="text/javascript">alert("접근 권한이 없습니다.");</script>');
    }
});

/////관리자_설문 승인 기능
app.get('/approval_survey/:reg_id/:sur_title', function(req, res) {
	let id=req.params.reg_id;
    let sur_title=req.params.sur_title;
    
    if(req.session.authority){
        if(req.session.loggedin){
            connection.query('UPDATE survey SET condi=1 WHERE reg_id =? AND sur_title=?;',[id,sur_title],function(error){
                if (error) throw error;
                res.send('<script type="text/javascript">alert("설문이 승인되었습니다."); document.location.href="/adm_approval";</script>');
            });
        }else{
            res.send('<script type="text/javascript">alert("로그인이 필요합니다."); document.location.href="/login";</script>');
        }
    } else{
        res.send('<script type="text/javascript">alert("접근 권한이 없습니다.");</script>');
    }
  });

  /////관리자_설문 반려 기능
app.get('/reject_survey/:reg_id/:sur_title', function(req, res) {
	let id=req.params.reg_id;
    let sur_title=req.params.sur_title;
    
    if(req.session.authority){
        if(req.session.loggedin){
            connection.query('UPDATE survey SET condi=2 WHERE reg_id =? AND sur_title=?;',[id,sur_title],function(error){
                if (error) throw error;
                res.send('<script type="text/javascript">alert("설문이 반려되었습니다."); document.location.href="/adm_approval";</script>');
            });
        }else{
            res.send('<script type="text/javascript">alert("로그인이 필요합니다."); document.location.href="/login";</script>');
        }
    } else{
        res.send('<script type="text/javascript">alert("접근 권한이 없습니다.");</script>');
    }
  });

  /////관리자_반려 설문 페이지
app.get('/adm_rejected', (req, res) => {
    if(req.session.authority){
        if(req.session.loggedin){
            let id=req.session.userID;
            connection.query('SELECT survey.*,user.name FROM survey,user WHERE survey.reg_id=user.id AND condi=2;', function(error,results){
                if(results.length<=0){
                    res.send('<script type="text/javascript">alert("반려한 설문조사가 없습니다.");document.location.href="/adm_main"</script>');
                }else{
                    res.render('adm_rejected', { data: results, name:req.session.userID});
                }
            });
        } else{
            res.send('<script type="text/javascript">alert("로그인이 필요합니다."); document.location.href="/login";</script>');
        }
    }else{
        res.send('<script type="text/javascript">alert("접근 권한이 없습니다.");</script>');
    }
});

////관리자_회원 목록 페이지
app.get('/adm_userlist', (req, res) => {
    if(req.session.authority){
        if(req.session.loggedin){
            let id=req.session.userID;
            connection.query('SELECT * FROM user WHERE id!=?;',[id], function(error,results){
                if(results.length<=0){
                    res.send('<script type="text/javascript">alert("회원이 없습니다.");document.location.href="/adm_main"</script>');
                }else{
                    res.render('adm_userlist', { data: results, name:req.session.userID});
                }
            });
        } else{
            res.send('<script type="text/javascript">alert("로그인이 필요합니다."); document.location.href="/login";</script>');
        }
    }else{
        res.send('<script type="text/javascript">alert("접근 권한이 없습니다.");</script>');
    }
});
////관리자_회원 삭제 기능
app.get('/delet_user/:id', function(req, res) {
	let delet_id=req.params.id;
    
    if(req.session.authority){
        if(req.session.loggedin){
            connection.query('DELETE FROM user WHERE id=?;',[delet_id],function(error){
                if (error) throw error;
                res.send('<script type="text/javascript">alert("회원이 삭제되었습니다."); document.location.href="/adm_approval";</script>');
            });
        }else{
            res.send('<script type="text/javascript">alert("로그인이 필요합니다."); document.location.href="/login";</script>');
        }
    } else{
        res.send('<script type="text/javascript">alert("접근 권한이 없습니다.");</script>');
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