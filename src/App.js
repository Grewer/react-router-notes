import './App.css';
import {BrowserRouter, Route, Routes} from "./react-router-dom";


function App(props) {

    console.log('App', props)

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/about" element={<About/>}/>
                <Route path="/users" element={<Users/>}/>
                <Route path="/" element={<Home/>}/>
            </Routes>
        </BrowserRouter>
    );
}


function Home() {
    return <h2>Home</h2>;
}

function About() {
    return <h2>About</h2>;
}

function Users() {
    return <h2>Users</h2>;
}


export default App;
