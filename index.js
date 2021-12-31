const express = require('express');
const bcrypt = require ('bcrypt');
const session = require ('express-session');
const flash = require ('express-flash');
const multer = require ('multer');

const db = require('./connection/db');
const upload = require('./middleware/uploadFile');

const app = express();
// const PORT = 3000;
const PORT = process.env.PORT

function getFullTime(t) {
  let time = new Date(`${t}`);
  const months = [
    'January',
    'February',
    'March',
    'April',
    'Mei',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  let date = time.getDate();
  let month = months[time.getMonth()];
  let year = time.getFullYear();
  let hours = time.getHours();
  let minutes = time.getMinutes();

  return `${date} ${month} ${year} - ${hours}:${minutes} WIB`;
}

// using view engine handlebars
app.set('view engine', 'hbs');

// middleware
// registered foler public so it can access by browser
app.use('/public', express.static(__dirname + '/public'));

app.use('/uploads', express.static(__dirname + '/uploads'));

// app.use(express.static('public'));
// body parser
app.use(express.urlencoded({ extended: false }));

app.use(
    session({
        cookie: {
            maxAge: 2 * 60 * 60 * 1000,
            secure: false,
            httpOnly: true
      },
      store: new session.MemoryStore(),
      saveUninitialized: true,
      resave: false,
      secret: "secretValue"
  })
  );

app.use(flash())


// render home page
app.get('/', (req, res)=>{

  db.connect((err, client, done)=>{
    if (err) throw err

    client.query('SELECT * FROM experiences', (err, result)=>{
      let data = result.rows
      console.log(data)

      res.render('index', {data: data})
    })
  })
})

// render blog page
app.get('/blog', (req, res) => {
  
  let data = req.session;
  
  db.connect((err, client, done) => {
    done();
    if (err) throw err;
    client.query(`SELECT blog.id, blog.title, blog.content, blog.image, tb_user.name AS author, blog.post_date
    FROM blog LEFT JOIN tb_user
    ON blog.author_id = tb_user.id`, (err, result) => {
      let blogs = result.rows.map((blog) => {
        return {
          ...blog,
          post_age: getDisctanceTime(blog.post_date),
          post_date: getFullTime(blog.post_date),
          isLogin: data.isLogin,
          author: 'Yadi',
        };
      });
      blogs = blogs.reverse();
      res.render('blog', { isLogin :data.isLogin,  user: data.user, blogs });
    });
  });
});

// render add blog
app.get('/add-blog', (req, res) => {
  res.render('add-blog'); // render file add-blog
});

// add new blog
app.post('/blog', upload.single('image'), (req, res) => {

    let data = req.body

    if(!req.session.isLogin){
      req.flash('danger','please login')
      return res.redirect('/add-blog')
    }

    let authorId = req.session.user.id
    let image = req.file.filename
    // console.log(authorId)
    // console.log(image)
    // return console.log(req.body)
    let query = `INSERT INTO blog(author_id, title, image, content) VALUES ('${authorId}','${data.title}','${image}','${data.content}')`
    db.connect(function(err, client, done){
      if (err) throw err 

      client.query(query, function(err,result){
        if (err) throw err
        res.redirect('/blog')
      });
  });
});

// delete blog
app.get('/delete-blog/:id', (req, res) => {
  db.connect((err, client, done) => {
    done();
    if (err) throw err;

    client.query(
      `DELETE FROM blog WHERE id = $1`,
      [req.params.id],
      (error, result) => {
        if (error) throw error;
        res.redirect('/blog');
      }
    );
  });
});

// render edit blog
app.get('/edit-blog/:id', (req, res) => {
  db.connect((err, client, done) => {
    if (err) throw err;
    client.query(
      'SELECT * FROM blog WHERE id = $1',
      [req.params.id],
      (error, result) => {
        if (error) throw error;
        const [blog] = result.rows;
        res.render('edit-blog', { blog });
      }
    );
  });
});

// update blog
app.post(
  '/update-post/:id',
  upload.single('image'),
  (req, res) => {
    db.connect((err, client, done) => {
      done();
      if (err) throw err;
      client.query(
        'UPDATE blog SET title = $1, content = $2, image = $3 WHERE id = $4',
        [req.body.title, req.body.content, req.file.filename, req.params.id],
        (error, result) => {
          if (error) throw error;
          res.redirect('/blog');
        }
      );
    });
  }
);

// render contact post
app.get('/contact-me', (req, res) => {
  res.render('contact'); // render file blog
});

// render detail-blog
app.get('/detail-blog/:id', (req, res) => {
  db.connect((err, client, done) => {
    done();
    if (err) throw err;

    client.query(
      `SELECT * FROM blog WHERE id = ${req.params.id}`,
      (error, result) => {
        if (error) throw error;
        
        result.rows[0].image = '/uploads/'+ result.rows[0].image
        const blog = { ...result.rows[0],author: 'Yadi' };
        blog.post_date = getFullTime(`${blog.post_date}`);
        res.render('detail-blog', { blog });
      }
    );
  });
});

app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', (req, res) => {
  
  const data = req.body;

  const hashedPassword = bcrypt.hashSync(data.password, 10)

  let query = `INSERT INTO tb_user (name, email, password) VALUES ('${data.name}', '${data.email}', '${hashedPassword}')`

  db.connect(function(err,client, done){
    if (err) throw err;

    client.query(query, function(err, result){
      if (err) throw err;

      res.redirect('/login');

    });
  });
});

app.get('/login', (req, res) => {
  console.log(req.session)
  res.render('login');
});

app.post('/login', (req, res) => {
  
  const { email, password } = req.body;

  let query = `SELECT * FROM tb_user WHERE email = '${email}'`

  db.connect(function(err, client, done){
    if (err) throw err;

    client.query(query, function(err, result){
      if (err) throw err;

      if(result.rows.length == 0){
        req.flash('danger',"Email and password don't match!")
        return res.redirect('/login')
      }
      let isMatch = bcrypt.compareSync(password, result.rows[0].password);

      if(isMatch){
        req.session.isLogin = true
        req.session.user = {
          id: result.rows[0].id,
          name: result.rows[0].name,
          email: result.rows[0].email
        }
        
        req.flash('success','login success')
        res.redirect('/blog')
      }else {
        req.flash('danger',"Email and password don't match!")
        res.redirect('/login')
      };
    });
  });
});

app.get('/logout', (req, res) => {

  req.session.destroy()
  res.redirect('/login');

});
app.use((req, res) => {
  res.status(404);
  res.render('404');
});

app.listen(PORT, () => {
  console.log(`Server starting on http://localhost:${PORT}`);
});

function getDisctanceTime(time) {
  let timePosted = time;
  let timeNow = new Date();
  let timeDistance = timeNow - timePosted;

  // get time distance by day
  let distanceDay = Math.floor(timeDistance / (23 * 3600 * 1000));
  if (distanceDay == 1) {
    console.log(distanceDay);
    return `a day ago`;
  }
  if (distanceDay >= 1) {
    return `${distanceDay} days ago`;
  }

  // get time distance by hour
  let distanceHours = Math.floor(timeDistance / (1000 * 60 * 60));
  if (distanceHours == 1 ){
    console.log(distanceHours);
    return `hours ago`
  }
  if (distanceHours >= 1 ){
    return `${distanceHours} hours ago`
  }

  // get time distance by minutes
  let distanceMinutes = Math.floor(timeDistance / (60 * 1000));
  if (distanceMinutes == 1) {
    return `a minute ago`;
  }
  if (distanceMinutes > 1) {
    console.log(distanceMinutes + 'minutes');
    return `${distanceMinutes} minutes ago`;
  }

  // get time distance by second
  let distanceSeconds = Math.floor(timeDistance / 1000);
  if (distanceSeconds <= 1) {
    return `Just Now`;
  }
  if (distanceSeconds > 1) {
    console.log(distanceSeconds + 'seconds');
    return `${distanceSeconds} second ago`;
  }
}

