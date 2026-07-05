import { Link } from 'react-router-dom';

import { MissingCatCard } from './MissingCatCard';

const SAMPLE_CATS = [
  {
    name: 'Milo',
    photo:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCEhVGRdoq5-yeQfVhTccDWFWkQDQt4RfIwTvdrsEbei1MnUHR2zW90mkY2ZERONvekgwcjYLcfCMivzC1t8mic8n03VDbHJNDbypG6bMQLLjYHMrMG0hhLaaPvKuF2aqYmx5Jny1ibB6HNhbjxdb-PARGPW2T9jZ1ZTvt8FXsjc1rSL7lZ1uqjiagyX2ghl5XxIcVpvTbfnCbFgW_cS3ZA3weG6w76jkjnQwuzQRQ8QgoIKo-n8WRRqw',
    area: 'Brooklyn, Heights',
    lastSeen: 'Oct 12, 2024',
  },
  {
    name: 'Luna',
    photo:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCRkR5LxEyUolnlmDsuumnbsZh9rfNxaD-jH6BBJfw_IGQTTbmNMaldnfdu90f8oUDOQfLJPubvrr3KugLtiMQPj7QWFrWBna2BH6OmmiFRgSU5o0WxunfAC3tszPpaz-ZJUXshYouD3RkfzlU45uslQZ-Ctk9-U2U5IBEwMDM1PQ4QpoFgD23Q8H_q3UGV-msF9YBFKgLdO2qctELMX7LrZn94Nly1Psi5k7RdvpCZb-ZZ_Qf0dFY44A',
    area: 'Williamsburg',
    lastSeen: 'Oct 10, 2024',
  },
  {
    name: 'Patches',
    photo:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuClQFnzg8EbIxLbS8ZLEjKf7CqclGZsrQ4xuihgiDe_KNHgDTAnR9fgiuNcA73ZhgcLPwalzWtChfua36tgeStRCntKWpPd9CF5whGHrfnZvAdV5o_Jq7NJdZCEhmQ-il_xORd2BGKrl6oGMHz4vRNfNQvS06dXudBV37Sr_vrwANNwoWbeLBSlkmeuk2O1Yue1w3RlTtviaTDoOp8oqsvVf7OmvLXLGrmM0F9FKRhaMMWlDGr3jhyVWQ',
    area: 'Park Slope',
    lastSeen: 'Oct 14, 2024',
  },
  {
    name: 'Oliver',
    photo:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDAxHVrNPqzKuDMhx_A0ogmskEWwWXFHJLMgZB6_nh1UNlzV7MgR15PB3nhBHDwn7mbATalHvl9yOsh8iNNX34p9G7Sz70Vt1GD3WMA98sM1bm4ex2LX2r1KrDP9uJoUAmd7qmov2vx7sLsKzXluNd3EZXdTmKqEmvg7qCUKoOSAMPjmDBvNyh9CFtbx0KfsGxVOLzQf9Mej3rU2VQzB5zVYgRmiHzT95oWRbfbgMJwn776CHaIyns0ow',
    area: 'Greenpoint',
    lastSeen: 'Oct 13, 2024',
  },
];

export function RecentlyReported() {
  return (
    <section className="py-xl bg-background">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-xl">
        <div className="flex flex-col md:flex-row justify-between items-end mb-xl gap-md">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-on-background mb-xs">
              Recently Reported
            </h2>
            <p className="font-body-lg text-body-lg text-secondary">
              Keep an eye out for these neighbors in your area.
            </p>
          </div>
          <Link
            className="text-on-background font-bold border-b-2 border-on-background pb-1 hover:text-primary-container hover:border-primary-container transition-colors"
            to="/missing"
          >
            View All Missing Cats
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
          {SAMPLE_CATS.map((cat) => (
            <MissingCatCard key={cat.name} {...cat} />
          ))}
        </div>
      </div>
    </section>
  );
}
