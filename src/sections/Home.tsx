import { Converter } from "../components/Converter"

export const Home=()=>
{
    return(
        <section id="home" className="relative min-h-screen flex items-center overflow-hidden">
            <div className="container max-w-6xl mx-auto px-8 pt-32 pb-20 relative">
                <Converter/>
            </div>
        </section>
    )
}