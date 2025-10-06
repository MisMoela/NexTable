const {Client} = require('pg')
const express=require('express')

const app = express()
app.use(express.json())

const con = new Client({
    host:"localhost",
    user: "postgres",
    port: 5432,
    password:"Jakarta2143658709.",
    database:"demodb"
})

con.connect().then(() => console.log("Connected to db"))

app.post('/postData', (req,res) => {
    const {name,id} = req.body
    const insert_querry='INSERT INTO demo (name,id) VALUES ($1,$2)'

    con.query(insert_querry, [name, id],(err, result) => {
        if(err) {
            res.send(err)
        } else {
            console.log(result)
            res.send("Posted Data")
        }
    })
})

app.get('/fetchData', (req,res) => {
    const fetch_querry = "SELECT * FROM demo"

    con.query(fetch_querry, (err, result) => {
        if(err) {
            res.send(err)
        } else {
            res.send(result.rows)
        }
    })
})

app.get('/fetchbyId/:id', (req,res) => {
    const id = req.params.id
    const fetch_querry = "SELECT * FROM demo WHERE id = $1"

    con.query(fetch_querry, [id], (err,result) => {
        if(err) {
            res.send(err)
        } else {
            res.send(result.rows[0])
        }
    })
})

app.put('/update/:id', (req,res) => {
    const id = req.params.id 
    const name = req.body.name
    const update_querry = "UPDATE demo SET name=$1 WHERE id=$2"

    con.query(update_querry, [name,id], (err,result) => {
        if(err) {
            res.send(err)
        } else {
            res.send("UPDATED")
        }
    })
})

app.delete('/delete/:id', (req,res) => {
    const id = req.params.id
    const delete_querry = 'DELETE FROM demo WHERE id = $1'
    con.query(delete_querry, [id], (err, result) => {
        if (err) {
            res.send(err)
        } else {
            res.send("DELETED")
        }
    })
})

app.listen(4000, () => {
    console.log("server is running...")
})

