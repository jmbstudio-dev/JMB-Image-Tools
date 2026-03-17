import { Converter } from "../components/Converter";
import { Github, Linkedin } from "lucide-react";

const socialLinks = [
  {
    icon: Linkedin,
    href: "https://www.linkedin.com/in/johnmelvin-burgos",
    label: "LinkedIn",
  },
  { icon: Github, href: "https://github.com/jmbstudio-dev", label: "GitHub" },
];
export const Home = () => {
  const currentYear = new Date().getFullYear();
  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center overflow-hidden"
    >
      <div className="container max-w-6xl mx-auto px-8 pt-32 pb-20 relative ">
        <div>
          <Converter />
        </div>

        <div className="pt-12">
          <nav className="container mx-auto px-6">
            <div className="flex flex-col md:flex-row items-center justify-center gap-8">
              {/* Logo & Copyright */}

              <div>
                <p className="text-sm text-muted-foreground m-auto">
                  Thankyou for checking this out ! I am...
                </p>
              </div>

              {/* Social Links */}
              <div className="flex items-center gap-4">
                <a
                  href="https://jmbstudio.dev/"
                  className="text-xl font-bold tracking-tighter"
                >
                  JM<span className="text-primary">B</span>
                </a>

                {socialLinks.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    aria-label={social.label}
                    target="_blank"
                  >
                    <social.icon className="w-5 h-5" />
                  </a>
                ))}
              </div>
            </div>
          </nav>
        </div>
      </div>
    </section>
  );
};
