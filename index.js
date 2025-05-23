const express = require('express')
const { mongo } = require('mongoose');
const app = express()
const cors = require('cors')
require('dotenv').config()
const mongoose = require('mongoose');

app.use(cors())
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

//Añadimos linea para permitir a express recibir datos en formato json enviados por formulario
app.use(express.urlencoded({ extended: false }));
app.use(express.json()); // añade esta línea

mongoose.connect(process.env.MONGO_URI);



const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  exercises: [
    {
      description: String,
      duration: Number,
      date: Date
    }
  ]
});


const User = mongoose.model('User', userSchema);

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})

//Cremos la funcion para guardar un username en la BD de mongo
const saveUser = async (user, done) => {
try {
  const data = await user.save();
  done(null, data);
} catch (err) {
  console.error(err);
  done(err);
}
};

app.post('/api/users/', (req,res) => {
  const username = req.body.username
  
  const newUser = new User({
    username: username
  });

  saveUser(newUser, (err, data) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error saving user');
    }
    res.json({username: data.username, _id: data._id});
  });

});

//Al ser una version superior de mongoose, no es necesario el callback
app.get('/api/users', async (req,res) => {
  //mostar todos los usuarios en la base de datos
  //Un find vacio para que coja todos los usuarios
  try{
    //El segundo argumento es para que solo muestre el username y el _id
    const users = await User.find({},'username _id');
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error retrieving users');
  }
});

//Desde la version 8 de moongosse, ya no se utiliza el callback, es decirt una funciona antes de otra sino 
//que se sustituye por las llamadas asincronas o promesas, en los que primero se ejecuta la funcion
//y se pausa la ejecucion hasta que se resuelva la promesa, una vez resuelta se pasa a la siguietne funcion
app.post('/api/users/:_id/exercises', async (req, res) => {
  const _id = req.params._id;
  //Lo pongo como let, ya que si es const no se podria reasignar la variable
  let {description, duration, date} = req.body;

  if (!date) {
    date = new Date();
  } else {
    date = new Date(date);
    if (date.toString() === 'Invalid Date') {
      return res.status(400).json({ error: 'Invalid date format' });
    }
  }

  duration = Number(duration);
  if (isNaN(duration)) {
    return res.status(400).json({ error: 'Duration must be a number' });
  }


  //Guardamos en la base de datos el ejercicio
  const user = await User.findOne({ _id: _id });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  //se añade el ejercicio al array de ejercicios del usuario
  const exercise = {
      description,
      duration,
      date
    };

  user.exercises.push(exercise);
  await user.save();

  res.json({
    _id : _id,
    description: description,
    duration: duration,
    date: date
  })
});

app.get('/api/users/:_id/logs', async (req, res) => {
  const _id = req.params._id;
  const { from, to, limit } = req.query; // obtenemos los query params

  try {
    const user = await User.findById(_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Si no hay ejercicios, devolvemos un log vacío
    let logs = user.exercises || [];
    
    // Filtrar por fecha "from"
    if (from) {
      const fromDate = new Date(from);
      if (fromDate.toString() === 'Invalid Date') {
        return res.status(400).json({ error: 'Invalid from date' });
      }
      logs = logs.filter(ex => new Date(ex.date) >= fromDate);
    }

    // Filtrar por fecha "to"
    if (to) {
      const toDate = new Date(to);
      if (toDate.toString() === 'Invalid Date') {
        return res.status(400).json({ error: 'Invalid to date' });
      }
      logs = logs.filter(ex => new Date(ex.date) <= toDate);
    }

    // Limitar cantidad de registros
    if (limit) {
      const limitNum = Number(limit);
      if (isNaN(limitNum) || limitNum <= 0) {
        return res.status(400).json({ error: 'Limit must be a positive number' });
      }
      logs = logs.slice(0, limitNum);
    }

    // Mapear para devolver solo lo necesario y formato de fecha legible
    const formattedLogs = logs.map(ex => ({
      description: ex.description,
      duration: ex.duration,
      date: new Date(ex.date).toDateString()
    }));

    res.json({
      _id: user._id,
      username: user.username,
      count: formattedLogs.length,
      log: formattedLogs
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('Error retrieving user logs');
  }
});


exports.UserModel = User;
exports.saveUser = saveUser;
