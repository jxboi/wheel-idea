import { ExternalLink } from "lucide-react";
import { categoryColors } from "../../components/Icons";
import { projects } from "./projects";

export function ProjectLinks() {
  return (
    <section className="projects" aria-labelledby="projects-heading">
      <h2 id="projects-heading">Projects</h2>
      <div className="idea-grid">
        {projects.map((project, index) => (
          <a
            key={project.id}
            className="idea-card project-card"
            href={project.href}
            target="_blank"
            rel="noopener"
          >
            <span
              className="idea-card-top"
              style={{
                background: categoryColors[index % categoryColors.length],
              }}
            >
              <project.icon size={36} strokeWidth={1.3} />
            </span>
            <span className="idea-card-content">
              <span className="small muted">{project.kind}</span>
              <h3>{project.title}</h3>
              <p>{project.summary}</p>
            </span>
            <span className="idea-card-footer">
              <span className="small muted">Opens in a new tab</span>
              <ExternalLink size={15} aria-hidden="true" />
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
