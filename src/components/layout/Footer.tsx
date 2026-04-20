import { Car, Phone, MapPin, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 py-12">
      <div className="container grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Car className="h-6 w-6 text-blue-400" />
            <span className="text-white text-lg font-bold">АвтоМойка</span>
          </div>
          <p className="text-sm text-gray-400">
            Профессиональная автомойка с онлайн-записью. Качественный уход за вашим автомобилем.
          </p>
        </div>

        <div>
          <h3 className="text-white font-semibold mb-4">Навигация</h3>
          <ul className="space-y-2 text-sm">
            <li><Link to="/" className="hover:text-blue-400 transition-colors">Главная</Link></li>
            <li><Link to="/booking" className="hover:text-blue-400 transition-colors">Запись</Link></li>
            <li><Link to="/login" className="hover:text-blue-400 transition-colors">Вход</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-white font-semibold mb-4">Контакты</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-blue-400" />
              <span>+7 (999) 123-45-67</span>
            </li>
            <li className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-400" />
              <span>ул. Гаражная, 15</span>
            </li>
            <li className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-400" />
              <span>Пн–Вс: 8:00 – 22:00</span>
            </li>
          </ul>
        </div>
      </div>
      <div className="container mt-8 pt-6 border-t border-gray-800 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} АвтоМойка. Все права защищены.
      </div>
    </footer>
  );
}
