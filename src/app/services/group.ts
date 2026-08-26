import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Service()
export class Group {
    private http = inject(HttpClient);
    createGroup(group: object) {
        return this.http.post('http://localhost:3000/api/groups', group);
    }

    getGroup(){
        return this.http.get<any[]>('http://localhost:3000/api/groups');
    }

    requestJoin(title: string, username: string) {
        return this.http.post('http://localhost:3000/api/groups/join', { title, username });
    }

    approveJoin(title: string, username: string) {
        return this.http.post('http://localhost:3000/api/groups/approve', { title, username });
    }
}
