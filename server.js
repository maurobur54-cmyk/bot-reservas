
const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(bodyParser.json());

const FILE = "reservas.json";

const HORARIO_INICIO = 17;
const HORARIO_FIN = 23;

let estados = {};

// Crear archivo si no existe
if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, JSON.stringify([]));
}

function leerReservas() {
    return JSON.parse(fs.readFileSync(FILE));
}

function guardarReservas(data) {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

// Detectar día
function detectarDia(texto) {
    const dias = {
        domingo: 0,
        lunes: 1,
        martes: 2,
        miercoles: 3,
        jueves: 4,
        viernes: 5,
        sabado: 6
    };

    for (let d in dias) {
        if (texto.includes(d)) return dias[d];
    }

    if (texto.includes("mañana")) {
        return (new Date().getDay() + 1) % 7;
    }

    if (texto.includes("hoy")) {
        return new Date().getDay();
    }

    return new Date().getDay();
}

function esHorarioValido(diaSemana, hora) {
    if (hora < HORARIO_INICIO || hora > HORARIO_FIN) return false;

    if ((diaSemana === 2 || diaSemana === 4) && hora >= 18 && hora <= 20) {
        return false;
    }

    return true;
}

function sugerirHorarios(diaSemana, reservas) {
    let opciones = [];

    for (let h = HORARIO_INICIO; h <= HORARIO_FIN; h++) {
        if (!esHorarioValido(diaSemana, h)) continue;

        const cantidad = reservas.filter(r => r.hora === h && r.dia === diaSemana).length;

        if (cantidad < 2) {
            opciones.push(h + ":00");
        }
    }

    return opciones.slice(0, 3);
}

// RUTA PRINCIPAL
app.get("/", (req, res) => {
    res.send("Servidor funcionando correctamente ✅");
});

// VER RESERVAS (para panel web)
app.get("/reservas", (req, res) => {
    const reservas = leerReservas();
    res.json(reservas);
});

// ELIMINAR RESERVA
app.delete("/reservas/:numero", (req, res) => {
    const numero = req.params.numero;

    let reservas = leerReservas();
    reservas = reservas.filter(r => r.numero !== numero);

    guardarReservas(reservas);

    res.send("Eliminado ❌");
});

// PANEL WEB
app.get("/panel", (req, res) => {
    res.sendFile(path.join(__dirname, "panel.html"));
});

// MENSAJES (LÓGICA DE RESERVAS)
app.get("/mensaje", (req, res) => {
    const texto = (req.query.texto || "").toLowerCase();
    const numero = req.query.numero || "cliente";

    if (!texto) {
        return res.send("Hola 👋 Escribe: 'hoy 20' o 'mañana 19'");
    }

    let reservas = leerReservas();
    const diaSemana = detectarDia(texto);

    // CANCELAR
    if (texto.includes("cancelar")) {
        reservas = reservas.filter(r => r.numero !== numero);
        guardarReservas(reservas);
        estados[numero] = null;
        return res.send("❌ Cancelado");
    }

    // CONFIRMAR
    if (texto === "si" && estados[numero]) {
        const { hora, dia } = estados[numero];

        if (reservas.filter(r => r.hora === hora && r.dia === dia).length >= 2) {
            return res.send("Ese horario está lleno.");
        }

        reservas.push({ numero, hora, dia });
        guardarReservas(reservas);
        estados[numero] = null;

        return res.send("✅ Reserva confirmada");
    }

    // EXTRAER HORA
    const match = texto.match(/(\d{1,2})/);

    if (!match) {
        return res.send("No entendí la hora.");
    }

    let hora = parseInt(match[1]);
    if (hora < 8) hora += 12;

    if (!esHorarioValido(diaSemana, hora)) {
        const sugerencias = sugerirHorarios(diaSemana, reservas);
        return res.send("No disponible. Opciones: " + sugerencias.join(", "));
    }

    if (reservas.filter(r => r.hora === hora && r.dia === diaSemana).length >= 2) {
        const sugerencias = sugerirHorarios(diaSemana, reservas);
        return res.send("Hora llena. Opciones: " + sugerencias.join(", "));
    }

    estados[numero] = { hora, dia: diaSemana };

    res.send(`¿Confirmas ${hora}:00? Responde SI`);
});

// INICIAR SERVIDOR
app.listen(3000, () => {
    console.log("Servidor PRO 🚀");
});