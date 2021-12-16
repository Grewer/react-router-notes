import './App.css';
import {BrowserRouter, HashRouter, Route, Routes, useLocation} from "./react-router-dom";
import {useNavigate} from "react-router";


function App(props) {

    console.log('App1', props)

    return (
        <HashRouter>
            <Routes>
                <Route path="/about" element={<About/>}/>
                <Route path="/users" element={<Users/>}/>
                <Route path="/" element={<Home/>}/>
            </Routes>
        </HashRouter>
    );
}


function Home() {
    let nav = useNavigate();
    return <div>
        <h2>Home</h2>
        <button onClick={()=>{
            nav('/users')
        }}>users</button>
    </div>;
}

function About() {
    return <h2>About</h2>;
}

function Users() {
    return <h2>Users</h2>;
}


export default App;
