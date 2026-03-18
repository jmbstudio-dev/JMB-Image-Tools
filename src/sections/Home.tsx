import { Converter } from "../components/Converter";

export const Home = () => {
  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center overflow-hidden"
    >
      <div className="container max-w-6xl mx-auto px-8 pt-32 pb-20 relative ">
        <div>
          <Converter />
        </div>

        <div className="pt-12 container flex justify-center mx-auto px-6">
        <div>
          <p className="text-sm text-muted-foreground m-auto">
            Thankyou for checking this out!
          </p>
        </div>
      </div>
      </div>
    </section>
  );
};
