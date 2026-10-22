import { Link } from 'react-router-dom'
import { PageFrame } from '../layouts/PageFrame'

export default function NotFound() {
  return (
    <PageFrame sec="protocol" title="Not found" lede="This hash has no matching preimage. The page you asked for does not exist.">
      <section className="pf-ask">
        <h2>Back to the cube</h2>
        <p>Every real page sits on a layer of the cube. Pick one from the map, or go back to mining.</p>
        <Link className="pf-btn" to="/" viewTransition>
          Go to Mine
        </Link>
      </section>
    </PageFrame>
  )
}
