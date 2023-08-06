//Variables de entorno
require('dotenv').config()

//Express y modulos
const express = require('express');
const app = express();
const port = (process.env.PORT != '') ? process.env.PORT : 80;
const path = require('path');
//Bot de Minecraft
const mineflayer = require('mineflayer');
//modulo pathfinder
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const Movements = require('mineflayer-pathfinder').Movements;
const { GoalNear, GoalNearXZ } = require('mineflayer-pathfinder').goals;
//modulo movimiento
const movement = require("mineflayer-movement");
//modulo autoeat
const autoeat = require('mineflayer-auto-eat').plugin;
//modulo pvp
const pvp = require('mineflayer-pvp').plugin;

//Archivos estaticos
app.use(express.static('../public'));

//Para datos del post
app.use(express.urlencoded({ extended: true }));

//Root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
})

//Al hacer post
app.post('/', (req, res) => {
    //Funcion de validacion
    const validar = (variable) => {
        if ((variable != '') && (!variable.includes(" "))) {
            return true;
        } else {
            return false;
        }
    }

    //Variables
    const prefix = (req.body.prefijo != '') ? req.body.prefijo : '!';
    const servidor = (req.body.servidor != '') ? req.body.servidor : '';
    const nombre = (req.body.nombre != '') ? req.body.nombre : 'bot';
    const autenticacion = (req.body.autenticacion != '') ? req.body.autenticacion : 'offline';
    const puerto = (req.body.puerto != '') ? req.body.puerto : 25565;
    const version = (req.body.version != '') ? req.body.version : '';
    const chatInicial = (req.body.chat != '') ? req.body.chat : '';

    if (validar(servidor) != true) {
        return res.json({ mensaje: 'El servidor no puede estar vacio ni contener espacios.' });
    } else if (validar(nombre) != true) {
        return res.json({ mensaje: 'El nombre no puede estar vacio ni contener espacios.' });
    }

    //Crear bot
    const bot = mineflayer.createBot({
        host: servidor,
        username: nombre,
        auth: autenticacion,
        port: puerto,
        version: version
    });

    //Cargar plugins
    bot.loadPlugin(pathfinder);
    bot.loadPlugin(movement.plugin);
    bot.loadPlugin(autoeat);
    bot.loadPlugin(pvp);

    bot.once("login", function init() {
        //Cargar configuracion predeterminada
        const { Default } = bot.movement.goals;
        bot.movement.setGoal(Default);
        //Establecer estados de control
        bot.setControlState("forward", true);
        bot.setControlState("sprint", true);
        bot.setControlState("jump", true);
    })

    let spawneo = false;
    bot.once('spawn', () => {
        //Cuando spawnee acceder a los datos
        const mcData = require('minecraft-data')(bot.version);

        //Nueva instancia de movimiento
        const defaultMove = new Movements(bot, mcData);

        defaultMove.allow1by1towers = false;
        defaultMove.canDig = true;
        defaultMove.allowParkour = true;
        defaultMove.allowSprinting = true;
        defaultMove.scafoldingBlocks = [];

        defaultMove.scafoldingBlocks.push(mcData.itemsByName['dirt'].id);

        bot.pathfinder.setMovements(defaultMove);

        bot.on("physicsTick", function tick() {
            const entity = bot.nearestEntity(entity => entity.type === "player");
            if (entity) {
                // establecer el target de proximidad en el jugador mas cercano
                bot.movement.heuristic.get('proximity').target(entity.position);
                // moverse alrededor del jugador
                const yaw = bot.movement.getYaw(240, 15, 1);
                bot.movement.steer(yaw);
            }
        })

        //Mensaje
        if (chatInicial != '') {
            bot.chat(chatInicial);
        }
        //Respuesta
        res.json({ mensaje: `Bot iniciado: Nombre: ${nombre}, Servidor: ${servidor}` });
        spawneo = true;
    });

    //chat
    bot.on('chat', (username, message) => {
        //Solo ejecutar si no es el mismo usuario
        if (username == bot.username) return;

        //Solo usar si tiene el prefix
        if (!message.startsWith(prefix)) {
            return;
        }

        const args = message.slice(prefix.length).trim().split(/ +/g);
        const command = args.shift().toLowerCase();

        if (command == 'deci') {
            bot.chat(args.join(' '));
        }

        if (command == 'veni') {
            const target = bot.players[username] ? bot.players[username].entity : null;
            if (!target) {
                bot.chat('No te puedo ver, no se donde estas');
                return;
            }
            const player = target.position;
            bot.pathfinder.setGoal(new GoalNear(player.x, player.y, player.z, 1));
        }

        if (command == 'anda') {
            const x = parseInt(args[0]);
            const y = parseInt(args[1]);
            const z = parseInt(args[2]);
            bot.pathfinder.setGoal(new GoalNear(x, y, z, 1));
        }

        if (command == 'ir') {
            const x = parseInt(args[0]);
            const z = parseInt(args[1]);
            bot.pathfinder.setGoal(new GoalNearXZ(x, z, 1));
        }

        if (command === 'pvp') {
            const player = bot.players[username];
            if (!player) {
                bot.chat('No te veo.');
                return;
            }
            bot.pvp.attack(player.entity);
        }

        if (command === 'para') {
            bot.pvp.stop()
        }
    });

    //Log errores
    bot.on('error', console.log);
    bot.on('kicked', console.log);
    bot.on('end', console.log);
    if (spawneo == false) {
        return res.json({ mensaje: 'No se ha podido conectar con el servidor.' });
    }
});

//Consola
app.listen(port, () => {
    console.log(`Web escuchando en el puerto ${port}`)
});