export default async function Page({ params }: { params: { slug: string } }) {
  return (
    <div>
      <h1>Hello from {params.slug}</h1>
    </div>
  );
}

