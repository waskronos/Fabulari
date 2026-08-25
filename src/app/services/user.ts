import { inject, Service } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Service()
export class User {
    private http = inject(HttpClient);

    registerUser(user: object){
    return this.http.post('http://localhost:3000/api/users', user);
}   
}

