import { Section } from "@/components/ui/Section";
import { courseCatalog } from "@/lib/data";
import { RoleId } from "@/lib/types";
import { Card, Tag } from "@/components/ui/Primitives";

export function CourseCards({ role }: { role: RoleId }) {
  const courses = courseCatalog[role];

  return (
    <Section
      id="courses"
      eyebrow="Curated Courses"
      title="Top-rated courses for this path"
      description="Hand-picked from Udemy and Coursera — opens directly on their site."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <a
            key={course.title}
            href={course.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <Card className="h-full transition-colors hover:border-ink">
              <div className="mb-3 flex items-center justify-between">
                <Tag>{course.provider}</Tag>
                <span className="text-xs text-graphite">★ {course.rating.toFixed(1)}</span>
              </div>
              <p className="text-sm font-medium leading-snug text-ink">
                {course.title}
              </p>
              <p className="mt-2 text-xs text-graphite">{course.level}</p>
              <p className="mt-4 text-xs font-medium text-ink underline decoration-line underline-offset-4">
                View course →
              </p>
            </Card>
          </a>
        ))}
      </div>
    </Section>
  );
}
